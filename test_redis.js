import { createClient } from 'redis';

const client = createClient({
  url: "redis://127.0.0.1:6379"
});

client.on('error', (err) => {
  console.error("❌ Redis Error:", err);
});

try {
  await client.connect();
  console.log("✅ Connected");

  const pong = await client.ping();
  console.log("Ping:", pong);

} catch (err) {
  console.error("❌ Connection failed:", err);
}