import { Link } from "@tanstack/react-router";

interface SubnavItem {
  label: string;
  to: string;
}

const ITEMS: SubnavItem[] = [
  { label: "Usage", to: "/usage" },
  { label: "Billing", to: "/billing" },
  { label: "Settings", to: "/profile" },
  { label: "Plans", to: "/pricing" },
];

export function AccountSubnav() {
  return (
    <div className="account-subnav">
      <div className="account-subnav-inner">
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeProps={{ className: "active" }}
            activeOptions={{ exact: true }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
