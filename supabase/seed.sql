-- Supabase Seed File
-- File: /supabase/seed.sql

-- Insert representative catalog of Kenya High School textbooks under 'CBC Kenya' curriculum category
INSERT INTO public.books (title, author, description, category, education_level, curriculum, subjects, cover_image, file_url)
VALUES
('CBC Grade 10 Mathematics', 'East African Educational Publishers', 'Comprehensive senior secondary mathematics textbook following the Kenyan Competency Based Curriculum (CBC) framework. Highlighting calculus foundations, quadratic equations, and complex plane theory.\n\nLocation: Kenya', 'Natural Sciences, Mathematics, and Statistics', 'School', 'CBC Kenya', 'Mathematics, Algebra', 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=400', 'cbc-g10-math.pdf'),

('CBC Grade 10 English Literature & Literacy', 'Kenya Literature Bureau (KLB)', 'Explores creative narrative prose, writing conventions, and advanced literary study for Kenyan Senior Schools under the CBC academic framework. Includes annotated African classical literature and essay guides.\n\nLocation: Kenya', 'Arts and Humanities', 'School', 'CBC Kenya', 'English, Literature', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=400', 'cbc-g10-english.pdf'),

('CBC Kidato cha Pili: Kiswahili Sanifu', 'Kenya Literature Bureau (KLB)', 'Mwongozo sahihi na sanifu wa Kiswahili kwa mtaala mpya wa CBC Kenya. Unalenga kuimarisha sarufi ya kiwango cha juu, hadithi fupi za kusisimua, na uchambuzi wa kina wa washairi na riwaya za Afrika Mashariki.\n\nLocation: Kenya', 'Arts and Humanities', 'School', 'CBC Kenya', 'Kiswahili, Fasihi', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400', 'cbc-g10-kiswahili.pdf'),

('CBC Grade 10 Integrated Science: Biology & Chemistry', 'Longhorn Publishers', 'An immersive experimental guide combining the essentials of chemistry and biology designed for Senior Secondary High School students under the CBC syllabus. Covers biological cell networks and chemical bonding.\n\nLocation: Kenya', 'Natural Sciences, Mathematics, and Statistics', 'School', 'CBC Kenya', 'Biology, Chemistry, Science', 'https://images.unsplash.com/photo-1532094349884-543bb1198343?auto=format&fit=crop&q=80&w=400', 'cbc-g10-intscience.pdf'),

('CBC Grade 10 Physics', 'Jomo Kenyatta Foundation (JKF)', 'A highly technical high school textbook aligning with the CBC Kenya standards. Thoroughly explores vector systems, thermal thermodynamics, mechanical work, and kinetic force diagrams with practical lab experiments.\n\nLocation: Kenya', 'Natural Sciences, Mathematics, and Statistics', 'School', 'CBC Kenya', 'Physics, Science', 'https://images.unsplash.com/photo-1554558727-6f81c9535aa7?auto=format&fit=crop&q=80&w=400', 'cbc-g10-physics.pdf'),

('CBC Grade 10 Agriculture & Life Sciences', 'Longhorn Publishers', 'Practical handbook focused on modern agricultural methodologies in Kenya, covering sustainable soil enrichment, precision irrigation systems, crop preservation, and economic value chains.\n\nLocation: Kenya', 'Agriculture, Forestry, Fisheries, and Veterinary', 'School', 'CBC Kenya', 'Agriculture, Nutrition', 'https://images.unsplash.com/photo-1464226184884-fa280b87c3a9?auto=format&fit=crop&q=80&w=400', 'cbc-g10-agri.pdf'),

('CBC Grade 10 Computer Science & AI Foundations', 'Jomo Kenyatta Foundation (JKF)', 'Comprehensive secondary curriculum guide covering Python algorithms, computer network architectures, cybersecurity baselines, and introductory automation in the Kenyan digital economy.\n\nLocation: Kenya', 'Information and Communication Technologies (ICT)', 'School', 'CBC Kenya', 'Computer Science, Coding, ICT', 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=400', 'cbc-g10-computerscience.pdf')
ON CONFLICT (title, author) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  education_level = EXCLUDED.education_level,
  curriculum = EXCLUDED.curriculum,
  subjects = EXCLUDED.subjects,
  cover_image = EXCLUDED.cover_image,
  file_url = EXCLUDED.file_url;
