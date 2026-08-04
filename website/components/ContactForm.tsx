"use client";

import { FormEvent, useState } from "react";
import { Send, Check } from "lucide-react";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isInvestor, setIsInvestor] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = isInvestor ? `Investor Inquiry from ${name}` : `Contact Form: ${name}`;
    const body = `${message}\n\n— ${name} (${email})`;
    const mailto = `mailto:${isInvestor ? "investors" : "hello"}@angel.tech?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setSent(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <label className="flex cursor-pointer items-center gap-3 border border-glass bg-glass-fill p-4">
        <input
          type="checkbox"
          checked={isInvestor}
          onChange={(e) => setIsInvestor(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        <span className="font-mono text-xs uppercase tracking-widest2 text-ink-muted">
          This is an investor inquiry
        </span>
      </label>

      <div>
        <label htmlFor="name" className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full border border-glass bg-transparent px-4 py-3 font-body text-white placeholder:text-ink-dim focus:border-accent focus:outline-none"
          placeholder="Jane Doe"
        />
      </div>

      <div>
        <label htmlFor="email" className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full border border-glass bg-transparent px-4 py-3 font-body text-white placeholder:text-ink-dim focus:border-accent focus:outline-none"
          placeholder="jane@example.com"
        />
      </div>

      <div>
        <label htmlFor="message" className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">
          Message
        </label>
        <textarea
          id="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-2 w-full resize-none border border-glass bg-transparent px-4 py-3 font-body text-white placeholder:text-ink-dim focus:border-accent focus:outline-none"
          placeholder={isInvestor ? "Tell us about your fund and areas of interest…" : "How can we help?"}
        />
      </div>

      <button
        type="submit"
        className="group inline-flex w-full items-center justify-center gap-2 border border-accent bg-accent px-8 py-4 font-mono text-xs font-bold uppercase tracking-widest2 text-white transition-colors duration-100 hover:border-accent-hover hover:bg-accent-hover sm:w-auto"
      >
        {sent ? (
          <>
            Opening Mail App <Check size={14} />
          </>
        ) : (
          <>
            Send Message <Send size={14} />
          </>
        )}
      </button>
    </form>
  );
}
