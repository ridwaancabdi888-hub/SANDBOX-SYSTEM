import { buildReceiptDoc, layoutBlocks } from "@/lib/printing";
import type { PrinterProfile, ReceiptData } from "@/lib/printing";
import { cn } from "@/lib/utils";

/**
 * On-screen receipt, rendered from the **same canonical blocks and the same
 * layout engine** the ESC/POS renderer uses. Lines are pre-wrapped to the
 * printer's column count and shown in a monospace column, so the preview is
 * character-for-character what the paper will show.
 *
 * This also backs the browser/system print path — `.print-area` is what the
 * @media print rules in globals.css expose to the print dialog.
 */
export function ReceiptDocument({
  data,
  profile,
  className,
}: {
  data: ReceiptData;
  profile: PrinterProfile;
  className?: string;
}) {
  const doc = buildReceiptDoc({ ...data, widthMm: profile.paperWidth }, profile);
  const laidOut = layoutBlocks(doc);
  const widthClass = profile.paperWidth === 58 ? "w-[58mm]" : "w-[80mm]";

  return (
    <div
      className={cn(
        "print-area mx-auto bg-white p-3 font-mono text-[11px] leading-tight text-black",
        widthClass,
        className
      )}
    >
      {laidOut.map(({ block, lines }, index) => {
        if (block.type === "logo") {
          // Browser/system printing renders the real image, so the preview
          // does too. ESC/POS transports gate this on `supportsImages`.
          return (
            <div key={index} className="mb-1 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded
                  Storage host; next/image needs build-time allow-listing. */}
              <img
                src={block.url}
                alt=""
                className="max-h-16 w-auto max-w-[60%] object-contain"
              />
            </div>
          );
        }

        if (block.type === "qr" || block.type === "barcode") {
          // The printer renders these natively; the preview shows a placeholder
          // so the cashier knows a code will be printed there.
          return (
            <div
              key={index}
              className="my-1 flex flex-col items-center gap-0.5 text-[9px] text-black/60"
            >
              <div className="flex h-10 w-10 items-center justify-center border border-dashed border-black/40">
                {block.type === "qr" ? "QR" : "|||"}
              </div>
              <span>{block.data}</span>
            </div>
          );
        }

        const align =
          block.type === "title"
            ? "center"
            : block.type === "text"
              ? (block.align ?? "left")
              : "left";

        const bold =
          block.type === "title" || ("bold" in block && block.bold) || false;

        return (
          <div
            key={index}
            className={cn(
              "whitespace-pre",
              align === "center" && "text-center",
              align === "right" && "text-right",
              bold && "font-bold",
              block.type === "title" && "text-sm"
            )}
          >
            {lines.map((line, lineIndex) => (
              <div key={lineIndex}>{line === "" ? " " : line}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
