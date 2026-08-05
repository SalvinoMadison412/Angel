import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";
import Accordion from "../Accordion";

const faqs = [
  {
    q: "How does Atom know the difference between a real crash and a pothole?",
    a: "Atom fuses accelerometer and gyroscope data through an onboard AI model trained on real-world collision datasets. It looks at impact force, deceleration rate, and orientation change together, not any single spike — so routine bumps don't trigger a false alarm.",
  },
  {
    q: "Does Atom need my phone to work?",
    a: "No. Atom has its own 4G LTE connection and GPS, so it can detect a crash and send an alert independently of your phone's battery, signal, or proximity. Pairing it with the companion app adds real-time monitoring, but isn't required for core alerts.",
  },
  {
    q: "Is there a monthly subscription fee?",
    a: "Core crash detection and automatic SOS alerting works out of the box with no subscription. Optional premium monitoring features are available through the companion app for users who want extended history and multi-device fleet views.",
  },
  {
    q: "How long does the battery last?",
    a: "Atom lasts up to 72 hours on standby from a single charge. It draws power over USB-C and is designed to sit mounted and topped up while your vehicle is running, so most owners never think about charging it separately.",
  },
  {
    q: "Can I cancel a false alarm?",
    a: "Yes. When Atom detects a possible crash, it starts a short countdown window before dispatching an alert, giving you time to confirm you're okay and cancel directly from the device or the companion app.",
  },
  {
    q: "What's the warranty and return policy?",
    a: "Every Atom ships with a 2-year manufacturer warranty covering hardware defects, plus a 30-day no-questions return window if it's not the right fit for you.",
  },
];

export default function ProductFAQ() {
  return (
    <section id="faq" className="border-b border-divider bg-bg-elevated py-28">
      <Container className="max-w-3xl">
        <Reveal>
          <SectionLabel index="FAQ">Common Questions</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Answers before you ask.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <Accordion items={faqs} />
        </Reveal>
      </Container>
    </section>
  );
}
