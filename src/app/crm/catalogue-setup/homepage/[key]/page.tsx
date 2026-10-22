import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionForm } from '@/components/ui/action-form'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { loadAdminCollections, loadAdminHomepage, slotChanged, type AdminSlot } from '@/lib/homepage/admin-data'
import { sourceValue } from '@/lib/homepage/form'
import { indiaDate, inWindow } from '@/lib/homepage/schedule'
import type { CollectionDef, HeroStat, OccasionCard, PackagingTile, SectionContent, SlotContent } from '@/lib/homepage/types'
import { removeHomepageSlot, saveHomepageSection, saveHomepageSlot } from '../../actions'
import { SECTION_LABELS } from '../../labels'
import { Badge, buttonClass, ClientInput, Field, inputClass, scheduleLabel, ScheduleFields, SetupNotice } from '../../ui'

const ICON_OPTIONS = [
  { id: 'gift', label: 'Gift' },
  { id: 'pen', label: 'Pen (personalise)' },
  { id: 'truck', label: 'Truck (delivery)' },
  { id: 'map', label: 'Map pin (addresses)' },
  { id: 'search', label: 'Parcel search (tracking)' },
]

function SourceSelect({ name, value, collections, allowNone = false }: { name: string; value: string; collections: CollectionDef[]; allowNone?: boolean }) {
  return (
    <select name={name} defaultValue={value} className={inputClass}>
      {allowNone ? <option value="none">Keep the section&apos;s products</option> : null}
      <option value="auto">Automatic picks (built-in)</option>
      {collections.map((collection) => (
        <option key={collection.slug} value={`collection:${collection.slug}`}>
          Collection: {collection.title}
          {collection.status !== 'published' ? ' (draft)' : ''}
        </option>
      ))}
    </select>
  )
}

function CollectionSelect({ name, value, collections }: { name: string; value: string; collections: CollectionDef[] }) {
  return (
    <select name={name} defaultValue={value} className={inputClass}>
      <option value="">Choose a collection</option>
      {collections.map((collection) => (
        <option key={collection.slug} value={collection.slug}>
          {collection.title}
          {collection.status !== 'published' ? ' (draft)' : ''}
        </option>
      ))}
    </select>
  )
}

function CardFields({ card, collections, prefix, index }: { card?: OccasionCard; collections: CollectionDef[]; prefix: string; index?: number }) {
  const name = (field: string) => (index == null ? `${prefix}${field}` : `${prefix}_${field}_${index}`)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Card title">
        <input name={name('title')} defaultValue={card?.title || ''} className={inputClass} />
      </Field>
      <Field label="Kicker (small label above)">
        <input name={name('kicker')} defaultValue={card?.kicker || ''} className={inputClass} />
      </Field>
      <Field label="Line" wide>
        <input name={name('line')} defaultValue={card?.line || ''} className={inputClass} />
      </Field>
      <Field label="Collection (fills photos and From price)">
        <CollectionSelect name={name('collection')} value={card?.collectionSlug || ''} collections={collections} />
      </Field>
      <Field label="Link" hint="Blank opens the collection page.">
        <input name={name('href')} defaultValue={card?.href || ''} className={inputClass} placeholder="/collections/…" />
      </Field>
      <Field label="Size">
        <select name={name('size')} defaultValue={card?.size || 'large'} className={inputClass}>
          <option value="large">Large (3 photos)</option>
          <option value="small">Small (2 photos)</option>
        </select>
      </Field>
    </div>
  )
}

function RowControls({ prefix, index }: { prefix: string; index: number }) {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-600">
      <label className="flex items-center gap-2">
        Order
        <input name={`${prefix}_order_${index}`} type="number" defaultValue={index + 1} className="w-16 border border-gray-200 px-2 py-1" />
      </label>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" name={`${prefix}_remove_${index}`} /> Remove
      </label>
    </div>
  )
}

function SectionForm({ content, collections }: { content: SectionContent; collections: CollectionDef[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="visible" defaultChecked={content.visible} /> Show this section
        </label>
        <Field label={content.type === 'hero' ? 'Badge' : 'Eyebrow'}>
          <input name="eyebrow" defaultValue={content.eyebrow || ''} className={inputClass} />
        </Field>
        <Field label="Heading" hint="Wrap words in *asterisks* for the italic saffron accent." wide>
          <input name="heading" defaultValue={content.heading} className={inputClass} />
          <ClientInput value={content.heading} />
        </Field>
        <Field label={content.type === 'catalogue_grid' ? 'Intro' : 'Subtext'} wide>
          <textarea name="subtext" defaultValue={content.subtext || ''} rows={2} className={inputClass} />
          <ClientInput value={content.subtext} />
        </Field>
        {content.type !== 'catalogue_grid' && content.type !== 'packaging' ? (
          <>
            <Field label="Button label">
              <input name="cta_label" defaultValue={content.ctaLabel || ''} className={inputClass} />
            </Field>
            <Field label="Button link">
              <input name="cta_href" defaultValue={content.ctaHref || ''} className={inputClass} />
            </Field>
          </>
        ) : null}
        {content.type === 'hero' ? (
          <>
            <Field label="Second button label">
              <input name="cta2_label" defaultValue={content.cta2Label || ''} className={inputClass} />
            </Field>
            <Field label="Second button link">
              <input name="cta2_href" defaultValue={content.cta2Href || ''} className={inputClass} />
            </Field>
          </>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Show only between</h3>
        <ScheduleFields schedule={content.schedule} />
      </div>

      {content.type === 'hero' || content.type === 'product_rail' ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Products from" wide>
            <SourceSelect name="source" value={sourceValue(content.source)} collections={collections} />
          </Field>
          <Field label={content.type === 'hero' ? 'Products in the slider (4 per set)' : 'Products shown'}>
            <input name="item_count" type="number" min={content.type === 'hero' ? 4 : 1} max={24} defaultValue={content.itemCount} className={inputClass} />
          </Field>
          {content.type === 'product_rail' ? (
            <>
              <Field label="Columns on desktop">
                <select name="columns" defaultValue={String(content.columns)} className={inputClass}>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                </select>
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" name="dark" defaultChecked={content.dark} /> Charcoal festive band
              </label>
            </>
          ) : null}
        </div>
      ) : null}

      {content.type === 'catalogue_grid' ? (
        <Field label="Products before “Show more”">
          <input name="item_count" type="number" min={4} max={48} defaultValue={content.itemCount} className={inputClass} />
        </Field>
      ) : null}

      {content.type === 'hero' ? <StatRows stats={content.stats} /> : null}
      {content.type === 'occasion_grid' ? <CardRows cards={content.cards} collections={collections} /> : null}
      {content.type === 'packaging' ? <PackagingRows imageUrls={content.imageUrls} tiles={content.tiles} /> : null}
    </div>
  )
}

function StatRows({ stats }: { stats: HeroStat[] }) {
  const rows = [...stats, ...Array.from({ length: Math.max(0, 4 - stats.length) }, () => ({ title: '', text: '' }))]
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Stat strip (up to 4)</h3>
      <input type="hidden" name="stat_count" value={rows.length} />
      <div className="space-y-3">
        {rows.map((stat, index) => (
          <div key={index} className="grid gap-3 border border-gray-200 p-3 sm:grid-cols-[1fr_2fr_auto]">
            <Field label="Title">
              <input name={`stat_title_${index}`} defaultValue={stat.title} className={inputClass} />
              <ClientInput value={stat.title} />
            </Field>
            <Field label="Text">
              <input name={`stat_text_${index}`} defaultValue={stat.text} className={inputClass} />
              <ClientInput value={stat.text} />
            </Field>
            <RowControls prefix="stat" index={index} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CardRows({ cards, collections }: { cards: OccasionCard[]; collections: CollectionDef[] }) {
  const rows: (OccasionCard | undefined)[] = [...cards, undefined]
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Cards</h3>
      <p className="mb-3 text-xs text-gray-500">Fill the empty card at the end to add one. Three per row on desktop.</p>
      <input type="hidden" name="card_count" value={rows.length} />
      <div className="space-y-3">
        {rows.map((card, index) => (
          <div key={index} className="space-y-3 border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">{card ? `Card ${index + 1}` : 'New card'}</span>
              <RowControls prefix="card" index={index} />
            </div>
            <CardFields card={card} collections={collections} prefix="card" index={index} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PackagingRows({ imageUrls, tiles }: { imageUrls: string[]; tiles: PackagingTile[] }) {
  const rows = [...tiles, ...Array.from({ length: Math.max(0, 5 - tiles.length) }, () => ({ title: '', description: '', icon: 'gift' as const }))]
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Photo 1 URL" hint="Leave both blank for the automatic gift-box photos. Both are needed to show the photo row.">
          <input name="image_url_0" defaultValue={imageUrls[0] || ''} className={inputClass} />
        </Field>
        <Field label="Photo 2 URL">
          <input name="image_url_1" defaultValue={imageUrls[1] || ''} className={inputClass} />
        </Field>
      </div>
      <h3 className="text-sm font-semibold text-gray-900">Tiles (up to 5; the first is charcoal)</h3>
      <input type="hidden" name="tile_count" value={rows.length} />
      {rows.map((tile, index) => (
        <div key={index} className="grid gap-3 border border-gray-200 p-3 sm:grid-cols-[1fr_2fr_10rem]">
          <Field label="Title">
            <input name={`tile_title_${index}`} defaultValue={tile.title} className={inputClass} />
          </Field>
          <Field label="Description">
            <input name={`tile_description_${index}`} defaultValue={tile.description} className={inputClass} />
            <ClientInput value={tile.description} />
          </Field>
          <Field label="Icon">
            <select name={`tile_icon_${index}`} defaultValue={tile.icon} className={inputClass}>
              {ICON_OPTIONS.map((icon) => (
                <option key={icon.id} value={icon.id}>
                  {icon.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-3">
            <RowControls prefix="tile" index={index} />
          </div>
        </div>
      ))}
    </div>
  )
}

function SlotForm({ sectionId, slot, sectionType, collections }: { sectionId: string; slot?: AdminSlot; sectionType: SectionContent['type']; collections: CollectionDef[] }) {
  const content: SlotContent | null = slot?.draft || null
  const cardsOnly = sectionType === 'occasion_grid'
  const target = content?.target || (cardsOnly ? 'card' : 'section')
  return (
    <ActionForm action={saveHomepageSlot} successMessage="Slot saved to draft" resetOnSuccess={!slot} className="space-y-4">
      <input type="hidden" name="section_id" value={sectionId} />
      {slot ? <input type="hidden" name="slot_id" value={slot.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Label (for you; not shown)" wide>
          <input name="label" defaultValue={content?.label || ''} className={inputClass} placeholder="For example: Diwali 2026" />
        </Field>
        <Field label="Priority" hint="Higher wins when windows overlap.">
          <input name="priority" type="number" min={-100} max={100} defaultValue={content?.priority ?? 0} className={inputClass} />
        </Field>
      </div>
      <ScheduleFields schedule={content?.schedule} />
      {cardsOnly ? (
        <>
          <input type="hidden" name="target" value="card" />
          <Field label="Replace card number" hint="Blank adds the card at the end.">
            <input name="card_position" type="number" min={1} defaultValue={content?.cardPosition ?? ''} className={inputClass} />
          </Field>
          <CardFields card={content?.card} collections={collections} prefix="card_" />
        </>
      ) : (
        <>
          <input type="hidden" name="target" value={target} />
          <p className="text-xs text-gray-500">Only filled fields replace the section&apos;s own copy while the slot is live.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Eyebrow">
              <input name="o_eyebrow" defaultValue={content?.overrides?.eyebrow || ''} className={inputClass} />
            </Field>
            <Field label="Heading">
              <input name="o_heading" defaultValue={content?.overrides?.heading || ''} className={inputClass} />
            </Field>
            <Field label="Subtext" wide>
              <input name="o_subtext" defaultValue={content?.overrides?.subtext || ''} className={inputClass} />
            </Field>
            <Field label="Button label">
              <input name="o_cta_label" defaultValue={content?.overrides?.ctaLabel || ''} className={inputClass} />
            </Field>
            <Field label="Button link">
              <input name="o_cta_href" defaultValue={content?.overrides?.ctaHref || ''} className={inputClass} />
            </Field>
            {sectionType === 'hero' || sectionType === 'product_rail' ? (
              <Field label="Products from" wide>
                <SourceSelect
                  name="o_source"
                  value={content?.overrides?.source ? sourceValue(content.overrides.source) : 'none'}
                  collections={collections}
                  allowNone
                />
              </Field>
            ) : null}
          </div>
        </>
      )}
      <SubmitButton className={buttonClass}>{slot ? 'Save slot' : 'Add slot'}</SubmitButton>
    </ActionForm>
  )
}

export default async function HomepageSectionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const [homepage, { collections }] = await Promise.all([loadAdminHomepage(), loadAdminCollections()])
  const section = homepage.sections.find((item) => item.key === key)
  if (!section) notFound()
  const label = SECTION_LABELS[section.type]
  const today = indiaDate()
  const slots = homepage.slots.filter((slot) => slot.sectionId === section.id)
  const removedSlots = slots.filter((slot) => !slot.draft)
  const liveSlots = slots.filter((slot) => slot.draft)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/crm/catalogue-setup/homepage" className="text-xs font-semibold uppercase tracking-wider text-[#9E4300] hover:underline">
          ← All sections
        </Link>
        <h2 className="mt-2 font-serif text-2xl text-gray-900">{label.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{label.about}</p>
      </div>
      {!homepage.ready ? <SetupNotice>{homepage.reason}</SetupNotice> : null}

      <section className="border border-gray-200 bg-white p-4 sm:p-6">
        {homepage.ready && section.id ? (
          <ActionForm action={saveHomepageSection} successMessage="Saved to draft" className="space-y-6">
            <input type="hidden" name="id" value={section.id} />
            <SectionForm content={section.content} collections={collections} />
            <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
              <SubmitButton className={buttonClass}>Save draft</SubmitButton>
              <span className="text-xs text-gray-500">Publish from the section list when you are ready.</span>
            </div>
          </ActionForm>
        ) : (
          <fieldset disabled className="space-y-6 opacity-80">
            <SectionForm content={section.content} collections={collections} />
          </fieldset>
        )}
      </section>

      {section.type !== 'brand_row' && section.type !== 'catalogue_grid' ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Seasonal slots</h2>
            <p className="text-sm text-gray-500">
              {section.type === 'occasion_grid'
                ? 'Swap in or add a card for a date window, for example a festival card for a few weeks.'
                : 'Replace this section’s copy or products for a date window.'}{' '}
              Dates are India dates and include both ends. Slots go live with the next publish.
            </p>
          </div>
          {liveSlots.map((slot) => (
            <details key={slot.id} className="border border-gray-200 bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-4">
                <span className="font-semibold text-gray-900">{slot.draft?.label}</span>
                <Badge>{scheduleLabel(slot.draft?.schedule)}</Badge>
                <Badge>Priority {slot.draft?.priority ?? 0}</Badge>
                {slot.draft && inWindow(slot.draft.schedule, today) ? <Badge tone="live">In window today</Badge> : null}
                {slotChanged(slot) ? <Badge tone="draft">{slot.published ? 'Edited' : 'New, not published'}</Badge> : null}
              </summary>
              <div className="space-y-4 border-t border-gray-200 p-4">
                {homepage.ready && section.id ? (
                  <>
                    <SlotForm sectionId={section.id} slot={slot} sectionType={section.type} collections={collections} />
                    <ConfirmAction
                      title="Remove this slot?"
                      description={slot.published ? 'It stays live until the next publish.' : 'It was never published, so it is removed now.'}
                      confirmLabel="Remove"
                      action={removeHomepageSlot}
                      hiddenFields={{ slot_id: slot.id }}
                      successMessage="Slot removed"
                    >
                      Remove slot
                    </ConfirmAction>
                  </>
                ) : null}
              </div>
            </details>
          ))}
          {removedSlots.length ? (
            <p className="text-xs text-gray-500">
              {removedSlots.length} removed {removedSlots.length === 1 ? 'slot stays' : 'slots stay'} live until the next publish.
            </p>
          ) : null}
          {homepage.ready && section.id ? (
            <details className="border border-dashed border-gray-300 bg-white">
              <summary className="cursor-pointer p-4 text-sm font-semibold text-gray-900">Add a seasonal slot</summary>
              <div className="border-t border-gray-200 p-4">
                <SlotForm sectionId={section.id} sectionType={section.type} collections={collections} />
              </div>
            </details>
          ) : null}
          <p className="text-xs text-gray-500">
            {/* TODO(client): festival dates change every year; the client sets each window here. */}
            Festival dates move each year, so set each window from the client&apos;s calendar rather than relying on yearly repeat.
          </p>
        </section>
      ) : null}
    </div>
  )
}
