import Link from 'next/link'
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil } from 'lucide-react'
import { ActionForm } from '@/components/ui/action-form'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { loadAdminHomepage, slotChanged } from '@/lib/homepage/admin-data'
import { needsClientInput } from '@/lib/homepage/form'
import { plainHeading } from '@/lib/homepage/heading'
import { indiaDate, inWindow } from '@/lib/homepage/schedule'
import { discardHomepageDraft, moveHomepageSection, publishHomepage, toggleHomepageSection } from '../actions'
import { SECTION_LABELS } from '../labels'
import { Badge, buttonClass, ghostButtonClass, inputClass, scheduleLabel, SetupNotice } from '../ui'

export default async function HomepageSetupPage() {
  const homepage = await loadAdminHomepage()
  const today = indiaDate()
  const pending = homepage.ready && (homepage.sections.some((section) => section.changed) || homepage.slots.some(slotChanged))
  const lastPublished = homepage.sections.map((section) => section.publishedAt).filter(Boolean).sort().pop()

  return (
    <div className="space-y-6">
      {!homepage.ready ? <SetupNotice>{homepage.reason}</SetupNotice> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Publish</h2>
          <p className="mt-1 text-sm text-gray-500">
            Edits are saved as a draft. The store keeps showing the published version until you publish.
            {lastPublished ? (
              <>
                {' '}Last published{' '}
                {new Date(lastPublished).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST.
              </>
            ) : null}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {pending ? <Badge tone="draft">Unpublished changes</Badge> : <Badge tone="live">Store matches the draft</Badge>}
            {homepage.ready ? (
              <>
                <ActionForm action={publishHomepage} successMessage="Homepage published" className="inline">
                  <SubmitButton className={buttonClass} pendingLabel="Publishing…" disabled={!pending}>
                    Publish homepage
                  </SubmitButton>
                </ActionForm>
                <ConfirmAction
                  title="Discard draft changes?"
                  description="Every section and seasonal slot goes back to what the store shows now."
                  confirmLabel="Discard"
                  action={discardHomepageDraft}
                  successMessage="Draft discarded"
                >
                  Discard draft
                </ConfirmAction>
              </>
            ) : null}
          </div>
        </div>
        <form action="/home" method="get" target="_blank" className="border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Preview the draft</h2>
          <input type="hidden" name="preview" value="1" />
          <label className="mt-2 block text-xs font-semibold text-gray-600">
            As on (India date)
            <input type="date" name="date" defaultValue={today} className={inputClass} />
          </label>
          <button type="submit" className={`${ghostButtonClass} mt-3 w-full`}>
            Open preview
          </button>
          <p className="mt-2 text-[11px] text-gray-500">Opens the store with the draft and that date&apos;s seasonal slots. Only admins see previews.</p>
        </form>
      </div>

      <ol className="divide-y divide-gray-200 border border-gray-200 bg-white">
        {homepage.sections.map((section, index) => {
          const label = SECTION_LABELS[section.type]
          const slots = homepage.slots.filter((slot) => slot.sectionId === section.id && slot.draft)
          const activeToday = slots.filter((slot) => slot.draft && inWindow(slot.draft.schedule, today)).length
          const placeholder = JSON.stringify(section.content)
          return (
            <li key={section.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <span className="font-mono text-xs text-gray-400 sm:w-6">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9E4300]">{label.name}</span>
                  {!section.content.visible ? <Badge>Hidden</Badge> : null}
                  {section.content.schedule && (section.content.schedule.startsOn || section.content.schedule.endsOn) ? (
                    <Badge tone={inWindow(section.content.schedule, today) ? 'neutral' : 'warn'}>{scheduleLabel(section.content.schedule)}</Badge>
                  ) : null}
                  {slots.length ? <Badge>{slots.length} seasonal {slots.length === 1 ? 'slot' : 'slots'}{activeToday ? `, ${activeToday} live today` : ''}</Badge> : null}
                  {section.changed ? <Badge tone="draft">Edited</Badge> : null}
                  {needsClientInput(placeholder) ? <Badge tone="draft">Needs client input</Badge> : null}
                </div>
                <p className="mt-1 truncate font-serif text-lg text-gray-900">{plainHeading(section.content.heading) || label.name}</p>
              </div>
              {homepage.ready && section.id ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <ActionForm action={moveHomepageSection} className="inline" successMessage="Moved">
                    <input type="hidden" name="id" value={section.id} />
                    <input type="hidden" name="direction" value="up" />
                    <SubmitButton className={ghostButtonClass} disabled={index === 0} aria-label="Move up" pendingLabel="…">
                      <ArrowUp size={14} aria-hidden="true" />
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={moveHomepageSection} className="inline" successMessage="Moved">
                    <input type="hidden" name="id" value={section.id} />
                    <input type="hidden" name="direction" value="down" />
                    <SubmitButton className={ghostButtonClass} disabled={index === homepage.sections.length - 1} aria-label="Move down" pendingLabel="…">
                      <ArrowDown size={14} aria-hidden="true" />
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={toggleHomepageSection} className="inline" successMessage={section.content.visible ? 'Hidden in draft' : 'Shown in draft'}>
                    <input type="hidden" name="id" value={section.id} />
                    <SubmitButton className={ghostButtonClass} pendingLabel="…">
                      {section.content.visible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                      <span className="ml-1.5">{section.content.visible ? 'Hide' : 'Show'}</span>
                    </SubmitButton>
                  </ActionForm>
                  <Link href={`/crm/catalogue-setup/homepage/${section.key}`} className={ghostButtonClass}>
                    <Pencil size={14} aria-hidden="true" />
                    <span className="ml-1.5">Edit</span>
                  </Link>
                </div>
              ) : (
                <Link href={`/crm/catalogue-setup/homepage/${section.key}`} className={ghostButtonClass}>
                  View
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
