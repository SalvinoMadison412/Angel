import { HTMLAttributes } from "react";

export default function Container({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`mx-auto w-full max-w-container px-6 md:px-10 ${className}`} {...props} />;
}
