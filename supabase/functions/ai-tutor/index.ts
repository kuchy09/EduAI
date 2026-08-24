import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.20.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This Edge Function is designed to be deployed to Supabase, 
// allowing external clients (like a Flutter app) to hit it directly for AI tutor responses.
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    let { prompt, history, provider = 'gemini', messages, subject, studentName } = payload;

    // Handle alternative payload structure from curl / external clients
    if (messages && messages.length > 0 && !prompt) {
      prompt = messages[messages.length - 1].content;
      history = messages.slice(0, -1);
    }
    
    // Auth & Quota Logic
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    let userId: string | null = null;
    let supabase: any = null;

    if (supabaseUrl && supabaseServiceKey && authHeader) {
      const userClient = createClient(supabaseUrl, supabaseServiceKey, {
         global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
        supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // RPC Quota Check
        const { data: quotaInfo, error: quotaErr } = await supabase.rpc('check_tutor_quota', { p_user_id: user.id });
        if (quotaInfo && quotaInfo[0]?.is_over_limit) {
          return new Response(JSON.stringify({ error: 'Monthly token quota exceeded (Free tier: 50k tokens).' }), { 
             status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }
    }

    const recordUsage = async (inputTokens: number, outputTokens: number) => {
      if (!userId || !supabase || (inputTokens === 0 && outputTokens === 0)) return;
      try {
        await supabase.from('ai_tutor_usage').insert({
           user_id: userId,
           subject: subject || 'general',
           input_tokens: inputTokens,
           output_tokens: outputTokens,
           total_tokens: inputTokens + outputTokens
        });
      } catch (err) {
        console.error("Error recording usage:", err);
      }
    };

    const studentNameContext = studentName ? studentName : "User";
    const subjectContext = subject ? ` in the subject of ${subject}` : "";

    if (provider === 'anthropic') {
      const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set. Please set it using: supabase secrets set ANTHROPIC_API_KEY=...');
      }

      const anthropic = new Anthropic({ apiKey });
      
      const systemPrompt = `You are an AI Tutor named Sage AI. Be helpful and concise${subjectContext}. You are tutoring ${studentNameContext}.\nWhen outputting mathematical expressions, physics formulas, chemical equations, or variables, you MUST use standard LaTeX notation. For standalone equations on a new line (display mode), wrap the LaTeX in double dollar signs, like this: $$E = mc^2$$. For minor variables or short equations embedded directly inside a sentence (inline mode), wrap the LaTeX in single dollar signs, like this: $f(x) = y$. Do not use raw unicode characters for math symbols; rely entirely on clean LaTeX syntax.`;

      const anthropicMessages: any[] = [];
      if (history && history.length > 0) {
        for (const msg of history) {
          anthropicMessages.push({
            role: msg.role === 'user' || msg.role === 'User' ? 'user' : 'assistant',
            content: msg.content
          });
        }
      }
      anthropicMessages.push({ role: 'user', content: prompt });

      const responseStream = await anthropic.messages.create({
        model: 'claude-3-7-sonnet-latest',
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let inputTokens = 0;
          let outputTokens = 0;
          try {
            for await (const chunk of responseStream) {
              if (chunk.type === 'message_start' && chunk.message?.usage?.input_tokens) {
                 inputTokens = chunk.message.usage.input_tokens;
              }
              if (chunk.type === 'message_delta' && chunk.usage?.output_tokens) {
                 outputTokens = chunk.usage.output_tokens;
              }
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                const data = JSON.stringify({ type: 'delta', text: chunk.delta.text });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }
            // Record token usage in Supabase asynchronously
            recordUsage(inputTokens, outputTokens);
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (err: any) {
            const data = JSON.stringify({ type: 'delta', text: `\n[Error: ${err.message}]` });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          }
        }
      });
      
      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' }
      });
    } else {
      // Default to Gemini
      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set. Please set it using: supabase secrets set GEMINI_API_KEY=...');
      }

      const systemPrompt = `You are an AI Tutor named Sage AI. Be helpful and concise${subjectContext}. You are tutoring ${studentNameContext}.\nWhen outputting mathematical expressions, physics formulas, chemical equations, or variables, you MUST use standard LaTeX notation. For standalone equations on a new line (display mode), wrap the LaTeX in double dollar signs, like this: $$E = mc^2$$. For minor variables or short equations embedded directly inside a sentence (inline mode), wrap the LaTeX in single dollar signs, like this: $f(x) = y$. Do not use raw unicode characters for math symbols; rely entirely on clean LaTeX syntax.`;
      
      let chatContext = systemPrompt + "\n\n";
      if (history && history.length > 0) {
        chatContext += history.map((m: any) => `${m.role === 'user' || m.role === 'User' ? studentNameContext : 'Sage AI'}: ${m.content}`).join('\n');
      }
      chatContext += `\n${studentNameContext}: ${prompt}\nSage AI (reply concisely):`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: chatContext }] }]
        })
      });

      if (!response.body) {
        throw new Error("No response body from Gemini API");
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let inputTokens = 0;
          let outputTokens = 0;
          try {
            const reader = response.body!.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              
              const lines = buffer.split('\n');
              buffer = lines.pop() || "";
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const dataStr = line.substring(6).trim();
                  if (dataStr === "" || dataStr === "[DONE]") continue;
                  try {
                    const dataJson = JSON.parse(dataStr);
                    
                    if (dataJson.usageMetadata) {
					   inputTokens = dataJson.usageMetadata.promptTokenCount || inputTokens;
					   outputTokens = dataJson.usageMetadata.candidatesTokenCount || outputTokens;
					}

                    const parts = dataJson.candidates?.[0]?.content?.parts;
                    if (parts && parts.length > 0) {
                      const text = parts[0].text;
                      if (text) {
                        const payload = JSON.stringify({ type: 'delta', text });
                        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                      }
                    }
                  } catch (e) {
                    console.error("Error parsing Gemini SSE", e);
                  }
                }
              }
            }
            
            // Record token usage in Supabase asynchronously
            recordUsage(inputTokens, outputTokens);
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (err: any) {
            const data = JSON.stringify({ type: 'delta', text: `\n[Error: ${err.message}]` });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          }
        }
      });
      
      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' }
      });
    }
  } catch (error: any) {
    console.error("Error generating chat response:", error);
    
    let errorMessage = "Failed to generate chat response";
    const errorStr = error?.toString() || JSON.stringify(error) || "";
    
    if ((error?.status === 400 || errorStr.includes('400')) && errorStr.includes('credit balance')) {
      errorMessage = "Your Anthropic API credit balance is too low. Please switch to the Gemini Model or add credits.";
      return new Response(JSON.stringify({ error: errorMessage }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (error?.status === 503 || errorStr.includes('503') || errorStr.includes('UNAVAILABLE') || errorStr.includes('high demand')) {
      errorMessage = "The AI model is currently experiencing high demand. Please try again in a few moments.";
      return new Response(JSON.stringify({ error: errorMessage }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: error.message || errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
