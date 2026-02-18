import { Monitor } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mb-8 flex items-center gap-2">
        <Monitor className="h-8 w-8 text-blue-600" />
        <span className="text-2xl font-bold tracking-tight text-slate-900">
          Digital Panda
        </span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
