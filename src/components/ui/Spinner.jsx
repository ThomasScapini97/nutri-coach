import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-8 h-8" };

export default function Spinner({ size = "md", className }) {
  return <Loader2 className={cn("animate-spin text-green-600", sizes[size], className)} />;
}
