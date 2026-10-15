import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router";
import { pageTitle } from "@contracts/seo";
import { useSeo } from "@/hooks/useSeo";

export default function NotFound() {
  useSeo((site) => ({ title: pageTitle("Page introuvable", site.siteName), noindex: true }));

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <h1 className="text-muted-foreground">Page introuvable</h1>
          <Button asChild className="w-full">
            <Link to="/">Retour à l&apos;accueil</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
