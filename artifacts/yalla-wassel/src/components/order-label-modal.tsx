import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function OrderLabelModal({ open, onOpenChange, order }: {
  open: boolean; onOpenChange: (b: boolean) => void; order: any;
}) {
  if (!order) return null;
  const trackingUrl = `${window.location.origin}/track/${order.trackingToken}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md print:shadow-none print:border-0" dir="rtl">
        <DialogHeader>
          <DialogTitle>ملصق الطلب</DialogTitle>
        </DialogHeader>
        <div className="label-printable space-y-4 p-2">
          <div className="text-center">
            <h2 className="text-2xl font-bold">{order.orderId}</h2>
            {order.priority === "urgent" && (
              <p className="inline-block mt-1 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold">عاجل</p>
            )}
          </div>
          <div className="flex justify-center bg-white p-3 rounded-xl">
            <QRCodeSVG value={trackingUrl} size={160} />
          </div>
          <div className="space-y-2 text-sm border rounded-xl p-3">
            <div><span className="font-bold">من:</span> {order.fromBusiness}</div>
            <div className="text-xs text-muted-foreground">{order.fromAddress}</div>
            <div className="border-t pt-2"><span className="font-bold">إلى:</span> {order.toCustomerName}</div>
            <div className="text-xs text-muted-foreground">{order.toAddress}</div>
            <div className="text-xs"><span className="font-bold">الهاتف:</span> {order.toPhone}</div>
          </div>
          <p className="text-[10px] text-center text-muted-foreground break-all">{trackingUrl}</p>
        </div>
        <div className="print:hidden">
          <Button className="w-full" onClick={() => window.print()}>
            <Printer className="ml-2 h-4 w-4" /> طباعة
          </Button>
        </div>
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .label-printable, .label-printable * { visibility: visible !important; }
            .label-printable { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
