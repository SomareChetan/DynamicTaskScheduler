import './globals.css';

export const metadata = {
  title: 'Aetheris AI — Dynamic Task Scheduler',
  description: 'AI-powered proactive scheduling agent that treats your time as a constrained optimization problem. Natural language task input, intelligent scheduling, and continuous learning.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
