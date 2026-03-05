// Removed metadata export to fix chunk loading error when used with client components
// Metadata should be in root layout or server component parents only

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
