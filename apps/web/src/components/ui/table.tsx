import type { HTMLAttributes, TableHTMLAttributes } from "react";

export function Table(props: TableHTMLAttributes<HTMLTableElement>) {
  return <table className="w-full text-left text-sm" {...props} />;
}

export function Th(props: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className="border-b border-gray-200 px-3 py-2 font-medium text-gray-500"
      {...props}
    />
  );
}

export function Td(props: HTMLAttributes<HTMLTableCellElement>) {
  return <td className="border-b border-gray-100 px-3 py-2" {...props} />;
}
