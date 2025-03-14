
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-indigo-50 p-4">
      <div className="luxury-card p-10 max-w-md mx-auto animate-fade-in">
        <div className="flex justify-center mb-8">
          <div className="rounded-full bg-amber-50 p-5">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
          </div>
        </div>
        <h1 className="font-playfair text-6xl font-bold mb-6 text-center">404</h1>
        <p className="text-xl text-muted-foreground mb-8 text-center">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex justify-center">
          <Button asChild size="lg" className="animate-slide-up hover-scale">
            <a href="/">Return to Home</a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
