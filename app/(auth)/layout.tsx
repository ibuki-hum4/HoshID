export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-[calc(100svh-8rem)] flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
