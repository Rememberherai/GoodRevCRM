import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PublicTextBlock({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  );
}
