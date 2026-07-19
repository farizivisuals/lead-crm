import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AutoPrint from "./AutoPrint";

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, clients(company_name, phone, profiles:primary_contact_profile_id(full_name)), quote_line_items(*)")
    .eq("id", quoteId)
    .single();

  if (!quote) notFound();

  const client = quote.clients as { company_name: string; phone: string | null; profiles: { full_name: string } | null } | null;
  const items = (quote.quote_line_items ?? []) as {
    description: string;
    quantity: number;
    unit_price: number;
    position: number;
  }[];
  items.sort((a, b) => a.position - b.position);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const quoteDate = new Date(quote.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const validUntil = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const fmt = (n: number) =>
    "KD " + n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <>
      <AutoPrint />
      <style>{`
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; color: #111; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "white", padding: "48px 56px", maxWidth: "800px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "48px" }}>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#111", letterSpacing: "-0.5px" }}>
              LEAD
            </div>
            <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>info@leadsolution.co</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#111", letterSpacing: "-1px" }}>QUOTE</div>
            <div style={{ fontSize: "14px", color: "#888", marginTop: "4px" }}>{quote.quote_number}</div>
          </div>
        </div>

        {/* Meta info row */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "40px", padding: "20px 24px", background: "#f8f8f8", borderRadius: "12px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
              Prepared for
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#111" }}>{client?.company_name}</div>
            {client?.profiles?.full_name && (
              <div style={{ fontSize: "13px", color: "#666", marginTop: "2px" }}>{client.profiles.full_name}</div>
            )}
            {client?.phone && (
              <div style={{ fontSize: "13px", color: "#888", marginTop: "2px" }}>{client.phone}</div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em" }}>Date</div>
              <div style={{ fontSize: "13px", color: "#444", marginTop: "2px" }}>{quoteDate}</div>
            </div>
            {validUntil && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em" }}>Valid until</div>
                <div style={{ fontSize: "13px", color: "#444", marginTop: "2px" }}>{validUntil}</div>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#111" }}>{quote.title}</div>
        </div>

        {/* Line items table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #111" }}>
              <th style={{ textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "10px" }}>
                Description
              </th>
              <th style={{ textAlign: "right", fontSize: "11px", fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "10px", width: "80px" }}>
                Qty
              </th>
              <th style={{ textAlign: "right", fontSize: "11px", fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "10px", width: "120px" }}>
                Unit price
              </th>
              <th style={{ textAlign: "right", fontSize: "11px", fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "10px", width: "120px" }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "14px 0", fontSize: "14px", color: "#333" }}>{item.description}</td>
                <td style={{ padding: "14px 0", fontSize: "14px", color: "#555", textAlign: "right" }}>
                  {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}
                </td>
                <td style={{ padding: "14px 0", fontSize: "14px", color: "#555", textAlign: "right" }}>
                  {fmt(item.unit_price)}
                </td>
                <td style={{ padding: "14px 0", fontSize: "14px", fontWeight: 500, color: "#111", textAlign: "right" }}>
                  {fmt(item.quantity * item.unit_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "40px" }}>
          <div style={{ minWidth: "240px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderTop: "2px solid #111" }}>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#111" }}>Total</span>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#111" }}>{fmt(subtotal)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div style={{ padding: "20px 24px", background: "#f8f8f8", borderRadius: "12px", marginBottom: "40px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
              Notes &amp; terms
            </div>
            <div style={{ fontSize: "13px", color: "#555", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{quote.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "12px", color: "#bbb" }}>Thank you for your business.</div>
          <div style={{ fontSize: "12px", color: "#bbb" }}>{quote.quote_number}</div>
        </div>
      </div>

      {/* Screen-only close hint */}
      <div
        className="no-print"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          background: "#111",
          color: "white",
          padding: "10px 16px",
          borderRadius: "8px",
          fontSize: "13px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        Use <strong>File → Print</strong> or <strong>⌘P</strong> to save as PDF
      </div>
    </>
  );
}
