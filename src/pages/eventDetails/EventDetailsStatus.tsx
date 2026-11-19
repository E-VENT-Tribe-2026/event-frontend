export default function EventDetailsStatus({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">{message}</div>
  );
}
