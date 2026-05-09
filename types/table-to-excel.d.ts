declare module "@linways/table-to-excel" {
  export type SheetOpts = {
    name: string;
  };

  export type ConvertOpts = {
    name?: string;
    autoStyle?: boolean;
    sheet: SheetOpts;
  };

  const TableToExcel: {
    convert: (table: HTMLTableElement, opts?: ConvertOpts) => void;
  };

  export default TableToExcel;
}
