// Narrows down WHERE the Supabase connection breaks. Sends no password. Prints only network facts.
//   node --env-file=.env scripts/db-trace.mjs
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns/promises";

const host = process.env.SUPABASE_DB_HOST;
const port = Number(process.env.SUPABASE_DB_PORT);
const SSL_REQUEST = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]);

function probe(label, { family, ecdhCurve, minVersion, maxVersion, targetHost = host, targetPort = port, postgres = true, timeout = 12000 }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const finish = (msg) => {
      console.log(`${label.padEnd(46)} ${msg} (+${Date.now() - started}ms)`);
      resolve();
    };
    const raw = net.connect({ host: targetHost, port: targetPort, family, timeout });
    raw.on("timeout", () => { raw.destroy(); finish("TIMEOUT"); });
    raw.on("error", (e) => finish(`error ${e.code}`));
    const startTls = (socket) => {
      const secure = tls.connect({
        socket,
        servername: targetHost,
        rejectUnauthorized: false,
        ecdhCurve,
        minVersion,
        maxVersion,
      });
      secure.setTimeout(timeout, () => { secure.destroy(); finish("TLS TIMEOUT (ClientHello got no answer)"); });
      secure.on("secureConnect", () => { finish(`TLS OK ${secure.getProtocol()}`); secure.destroy(); });
      secure.on("error", (e) => finish(`TLS error ${e.code || e.message}`));
    };
    raw.on("connect", () => {
      if (!postgres) return startTls(raw);
      raw.write(SSL_REQUEST);
      raw.once("data", (d) => (String.fromCharCode(d[0]) === "S" ? startTls(raw) : finish("server refused TLS")));
    });
  });
}

const addrs = await dns.lookup(host, { all: true });
console.log("addresses:", addrs.map((a) => `IPv${a.family} ${a.address}`).join(", "));
console.log("node:", process.version, "openssl:", process.versions.openssl, "\n");

await probe("direct host, default TLS", {});
await probe("direct host, no post-quantum key share", { ecdhCurve: "X25519:prime256v1:secp384r1" });
await probe("direct host, TLS 1.2 only", { maxVersion: "TLSv1.2", ecdhCurve: "prime256v1" });
await probe("direct host, TLS 1.2 + X25519", { maxVersion: "TLSv1.2", ecdhCurve: "X25519" });
await probe("IPv6 control: google.com:443", { targetHost: "www.google.com", targetPort: 443, family: 6, postgres: false });
await probe("IPv4 control: supabase api :443", { targetHost: "deptadgzteiiiprquqah.supabase.co", targetPort: 443, family: 4, postgres: false });
