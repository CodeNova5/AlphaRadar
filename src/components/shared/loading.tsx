export function LoadingSpinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-12 w-12 rounded-full bg-danger/20 flex items-center justify-center">
        <span className="text-danger text-xl">!</span>
      </div>
      <p className="text-danger text-sm max-w-md text-center">{message}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-12 w-12 rounded-full bg-surface flex items-center justify-center">
        <span className="text-muted-foreground text-xl">0</span>
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
