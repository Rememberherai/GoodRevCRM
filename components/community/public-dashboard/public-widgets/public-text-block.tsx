export function PublicTextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-teal-500/5 p-8 md:p-12 text-center">
      <div className="w-12 h-1 bg-primary rounded-full mx-auto mb-6" />
      {title && <h3 className="text-xl md:text-2xl font-bold mb-4">{title}</h3>}
      <p className="whitespace-pre-wrap text-base md:text-lg leading-relaxed text-foreground/80 max-w-2xl mx-auto">
        {text}
      </p>
    </div>
  );
}
