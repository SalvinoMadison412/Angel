import Container from "../Container";

export default function DevelopmentNote() {
  return (
    <section className="bg-bg-elevated pb-20">
      <Container>
        <div className="border-l-2 border-accent bg-glass-fill px-6 py-5">
          <p className="font-body text-sm leading-relaxed text-ink-muted">
            Angel is in active development. Performance benchmarks, response times, and network coverage will be
            published as we validate our systems. We believe in showing you what we can prove, not what sounds
            good.
          </p>
        </div>
      </Container>
    </section>
  );
}
