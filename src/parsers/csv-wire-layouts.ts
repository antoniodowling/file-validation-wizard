/** Positional field metadata transcribed from the Huntington CSV Wire guide, accessed 2026-10-14.
 * https://developer.huntington.com/enterprisepayments/docs/wires-payments-automation
 * Numeric/date/conditional semantics are implemented separately. */
export interface WireField { readonly name: string; readonly max: number | null; readonly required: boolean; readonly blank: boolean }
export const WIRE_LAYOUTS: Readonly<Record<"USWIRE" | "INT", readonly WireField[]>> = {
  "USWIRE": [
    {
      "name": "Payment Type",
      "max": null,
      "required": true,
      "blank": false
    },
    {
      "name": "Effective Date",
      "max": null,
      "required": true,
      "blank": false
    },
    {
      "name": "Payment Amount",
      "max": null,
      "required": true,
      "blank": false
    },
    {
      "name": "Customer Reference",
      "max": 16,
      "required": false,
      "blank": false
    },
    {
      "name": "Debit Account Number",
      "max": 34,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Name",
      "max": 35,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Account Type",
      "max": 6,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Account Number",
      "max": 34,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Address Line 1",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Address Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary City",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Postal Code",
      "max": 15,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Country",
      "max": 2,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Name",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Code Type",
      "max": 6,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Code",
      "max": 9,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Address Line 1",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Address Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Bank City",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Country",
      "max": 2,
      "required": false,
      "blank": false
    },
    {
      "name": "Charges",
      "max": 3,
      "required": false,
      "blank": true
    },
    {
      "name": "Purpose of Wire",
      "max": 35,
      "required": true,
      "blank": false
    },
    {
      "name": "Payment Details Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Payment Details Line 3",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Payment Details Line 4",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Name",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Code Type",
      "max": 6,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Code",
      "max": 9,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Address Line 1",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Address Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank City",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Country",
      "max": 2,
      "required": false,
      "blank": false
    },
    {
      "name": "Comments",
      "max": 140,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 1",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 3",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 4",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Orginator ID Type",
      "max": 6,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator ID",
      "max": 35,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator Name",
      "max": 35,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator Address 1",
      "max": 35,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator Address 2",
      "max": 35,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator Postal Code",
      "max": 15,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator Country",
      "max": 2,
      "required": false,
      "blank": true
    },
    {
      "name": "2nd Intermediary Bank Name",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank Code Type",
      "max": 6,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank Code",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank Address Line 1",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank Address Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank City",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank State",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank Country",
      "max": 2,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 5",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 6",
      "max": 35,
      "required": false,
      "blank": false
    }
  ],
  "INT": [
    {
      "name": "Payment Type",
      "max": null,
      "required": true,
      "blank": false
    },
    {
      "name": "Effective Date",
      "max": null,
      "required": true,
      "blank": false
    },
    {
      "name": "Credit Amount",
      "max": null,
      "required": false,
      "blank": false
    },
    {
      "name": "Customer Reference",
      "max": 16,
      "required": false,
      "blank": false
    },
    {
      "name": "Credit Currency",
      "max": 3,
      "required": true,
      "blank": false
    },
    {
      "name": "Debit Account Number",
      "max": 34,
      "required": true,
      "blank": false
    },
    {
      "name": "Debit Amount",
      "max": null,
      "required": true,
      "blank": false
    },
    {
      "name": "FX Exchange Rate",
      "max": null,
      "required": false,
      "blank": false
    },
    {
      "name": "FX Contract ID",
      "max": 16,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Name",
      "max": 35,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Account Type",
      "max": 6,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Account Number",
      "max": 34,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Address Line 1",
      "max": 35,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Address Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary City",
      "max": 35,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Postal Code",
      "max": 15,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Country",
      "max": 2,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Name",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Code Type",
      "max": 6,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Code",
      "max": 35,
      "required": true,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Address Line 1",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Address Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Bank City",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Beneficiary Bank Country",
      "max": 2,
      "required": false,
      "blank": false
    },
    {
      "name": "Charges",
      "max": 3,
      "required": true,
      "blank": false
    },
    {
      "name": "Purpose of Wire",
      "max": 35,
      "required": true,
      "blank": false
    },
    {
      "name": "Payment Details Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Payment Details Line 3",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Payment Details Line 4",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Name",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Code Type",
      "max": 6,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Code",
      "max": 34,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Address",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Address",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank City",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Intermediary Bank Country",
      "max": 2,
      "required": false,
      "blank": false
    },
    {
      "name": "Comments",
      "max": 140,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 1",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 3",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 4",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Orginator ID Type",
      "max": 6,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator ID",
      "max": 35,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator Name",
      "max": 35,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator Address 1",
      "max": 35,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator Address 2",
      "max": 35,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator City",
      "max": 35,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator Postal Code",
      "max": 15,
      "required": false,
      "blank": true
    },
    {
      "name": "Originator Country",
      "max": 2,
      "required": false,
      "blank": true
    },
    {
      "name": "2nd Intermediary Bank Name",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank Code Type",
      "max": 6,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank Code",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank Address Line 1",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank Address Line 2",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank City",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "2nd Intermediary Bank Country",
      "max": 2,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 5",
      "max": 35,
      "required": false,
      "blank": false
    },
    {
      "name": "Bank to Bank Instructions Line 6",
      "max": 35,
      "required": false,
      "blank": false
    }
  ]
};
