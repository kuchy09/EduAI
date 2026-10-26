import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

async function test() {
  const rawEndpoint = process.env.B2_ENDPOINT || "https://s3.us-west-004.backblazeb2.com";
  const endpoint = rawEndpoint.startsWith('http') ? rawEndpoint : `https://${rawEndpoint}`;

  const s3Client = new S3Client({
    endpoint,
    region: process.env.B2_REGION || "us-west-004",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.B2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || "",
    },
  });

  const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || "";
  try {
    const testKey = "test-file-" + Date.now() + ".txt";
    // test upload
    console.log("Skipping put...");

    // test download
    console.log("Trying get...");
    const res = await s3Client.send(new GetObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: testKey
    }));
    console.log("Download successful:", res.ContentType, res.ContentLength);
  } catch (error) {
    console.error("Error:", error);
  }
}
test();
