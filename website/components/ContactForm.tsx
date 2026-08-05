"use client";

import { FormEvent, useState } from "react";
import { Send, Check } from "lucide-react";

type Tab = "general" | "investor";

export default function ContactForm() {
  const [tab, setTab] = useState<Tab>("general");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const isInvestor = tab === "investor";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = isInvestor ? `Investor Inquiry from ${name}` : `Contact Form: ${name}`;
    const body = `${message}\n\n— ${name}${company ? `, ${company}` : ""} (${email})`;
    const mailto = `mailto:${isInvestor ? "investors" : "hello"}@angel.tech?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setSent(true);
  };

  return (
    <div>
      <div className="flex border border-glass" role="tablist" aria-label="Inquiry type">
        {(
          [
            ["general", "General Inquiry"],
            ["investor", "Investor Inquiry"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex-1 border-r border-glass px-4 py-3.5 font-mono text-xs uppercase tracking-widest2 transition-colors duration-100 last:border-r-0 ${
              tab === value ? "bg-accent text-white" : "bg-transparent text-ink-muted hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isInvestor && (
        <p className="mt-4 border border-accent-border bg-accent/[0.08] px-4 py-3 font-body text-xs leading-relaxed text-ink-muted sm:text-sm">
          For investors: please include your fund name and typical check size in your message.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
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
          <label htmlFor="company" className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">
            {isInvestor ? "Fund / Company" : "Company"}
          </label>
          <input
            id="company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="mt-2 w-full border border-glass bg-transparent px-4 py-3 font-body text-white placeholder:text-ink-dim focus:border-accent focus:outline-none"
            placeholder={isInvestor ? "Acme Ventures" : "Acme Inc."}
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
            placeholder={
              isInvestor
                ? "Tell us about your fund, typical check size, and areas of interest…"
                : "How can we help?"
            }
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
    </div>
  );
}
