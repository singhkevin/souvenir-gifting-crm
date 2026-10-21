/**
 * Souvenir v2 – site-wide content placeholders.
 * Every value here is a placeholder awaiting real data from the client.
 * Render these as-is so they are visually obvious on the page.
 */

export const siteContent = {
  // TODO(client): Replace with real GSTIN from Kevin
  gstin: '[GSTIN]',
  // TODO(client): Replace with real CIN from Kevin
  cin: '[CIN]',
  // TODO(client): Replace with real registered office address
  registeredAddress: '[Registered address]',
  // TODO(client): Replace with studio / warehouse addresses
  studioAddress: '[Studio address]',
  // TODO(client): Replace with real phone number
  phone: '[+91 XXXXX XXXXX]',
  // TODO(client): Replace with real WhatsApp number
  whatsapp: '[+91 XXXXX XXXXX]',
  // TODO(client): Replace with real email address
  email: '[Email]',

  stats: {
    // TODO(client): Replace with verified PIN code count
    pinCodes: '[X]+ PIN codes served',
    // TODO(client): Replace with verified dispatch SLA
    dispatch: '[X]-hour dispatch',
    // TODO(client): Replace with verified breakage guarantee %
    breakageCover: '[X]% breakage cover',
    // TODO(client): Replace with verified quote turnaround time
    quoteTurnaround: 'Quotes within [X] hours',
    // TODO(client): Replace with verified average response time
    avgResponse: 'Avg response [X] mins',
    // TODO(client): Replace with verified minimum order value
    minimumOrder: 'Minimum order ₹[X]',
  },

  // TODO(client): Replace with real client logos (provide URLs or upload to /public/clients/)
  clientLogos: [
    '[Client logo 1]',
    '[Client logo 2]',
    '[Client logo 3]',
    '[Client logo 4]',
    '[Client logo 5]',
    '[Client logo 6]',
  ],

  // TODO(client): Replace with real partner brand names
  partnerBrands: [
    '[Partner brand 1]',
    '[Partner brand 2]',
    '[Partner brand 3]',
    '[Partner brand 4]',
    '[Partner brand 5]',
  ],

  // TODO(client): Replace with real case studies
  caseStudies: [
    {
      // TODO(client): Add case study details — company name, quantity, cities
      title: '[Case study: company, qty, cities]',
      description: '[Brief description of the project and outcome]',
      stat: '[X] kits',
      location: '[City]',
    },
  ],

  whySouvenir: [
    {
      // TODO(client): Verify pricing workflow description
      title: 'Indicative price, then a quote',
      description: 'Special price, catalogue price, then base price plus margin.',
    },
    {
      // TODO(client): Verify sample ordering workflow description
      title: 'One sample from stock',
      description: 'Buy a single sample on the store. Larger runs are quoted.',
    },
    {
      // TODO(client): Verify branding and mockup workflow description
      title: 'Branding on request',
      description: 'Mockups and personalisation sit with the quotation.',
    },
    {
      // TODO(client): Verify account fulfillment workflow description
      title: 'Orders, couriers and invoices in one place',
      description: 'Orders, couriers and invoices stay on the same account.',
    },
  ],

  // TODO(client): Replace with a real founder note and photo, or remove section
  founderNote: '[Founder note placeholder — a short message from the founder about the company mission]',

  utilityBar: {
    // TODO(client): Replace with verified dispatch status note
    dispatchStatus: '[Dispatch note]',
    // TODO(client): Replace with verified shipping note
    shippingNote: '[Pan-India Courier]',
    // TODO(client): Replace with verified GST note
    gstNote: '[GST ITC Compliant]',
  },
} as const

export type SiteContent = typeof siteContent
