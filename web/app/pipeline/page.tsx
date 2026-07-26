import { getPipeline } from "@/lib/queries";
import { StatusBadge } from "../ui";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { counts, channels, recent } = await getPipeline();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const inflight = (counts.new ?? 0) + (counts.pending_transcript ?? 0) + (counts.summarized ?? 0);
  const tiles: [string, number][] = [
    ["Videos tracked", total],
    ["Delivered", counts.notified ?? 0],
    ["In flight", inflight],
    ["Failed", (counts.failed ?? 0) + (counts.transcript_failed ?? 0)],
    ["Skipped (pre-history)", counts.seen_skipped ?? 0],
  ];

  return (
    <>
      <div className="tiles">
        {tiles.map(([label, value]) => (
          <div className="tile" key={label}>
            <div className="value">{value}</div>
            <div className="label">{label}</div>
          </div>
        ))}
      </div>

      <h3>Channels</h3>
      <table>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Videos</th>
            <th>Delivered</th>
            <th>Latest video</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((c) => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td className="num">{c.n}</td>
              <td className="num">{c.done}</td>
              <td className="num">{(c.latest ?? "").slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 24 }}>Recent activity</h3>
      {recent.length === 0 ? (
        <div className="notice">No processed videos yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Video</th>
              <th>Status</th>
              <th>Source</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((i, idx) => (
              <tr key={idx}>
                <td>
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    {i.title}
                  </a>
                  <span className="meta"> · {i.channel}</span>
                  {i.last_error && i.status !== "notified" && <div className="err">{i.last_error}</div>}
                </td>
                <td>
                  <StatusBadge value={i.status} />
                </td>
                <td>{i.has_transcript ? "captions" : "video (direct)"}</td>
                <td className="num">{(i.updated_at ?? "").replace("T", " ").replace("Z", "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
