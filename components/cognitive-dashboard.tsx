"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

const data = [
  { t: "00", e: 42, s: 28 }, { t: "04", e: 46, s: 35 }, { t: "08", e: 61, s: 39 },
  { t: "12", e: 73, s: 58 }, { t: "16", e: 70, s: 62 }, { t: "20", e: 78, s: 66 }
];

export function CognitiveDashboard() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <h2 className="mb-5 text-xl font-semibold">Cognitive Dashboard</h2>
      <div className="glass rounded-2xl p-5">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="episode" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="semantic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" stroke="#64748B" />
              <Tooltip contentStyle={{ background: "#0B1020", border: "1px solid #1F2937" }} />
              <Area type="monotone" dataKey="e" stroke="#8B5CF6" fillOpacity={1} fill="url(#episode)" />
              <Area type="monotone" dataKey="s" stroke="#22D3EE" fillOpacity={1} fill="url(#semantic)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
