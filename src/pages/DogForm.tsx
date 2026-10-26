import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Archive } from 'lucide-react';
import { usePractice, clientName } from '../stores/practice';
import { batchWriter, friendlyError, updateRecord } from '../lib/db';
import { Button, Card, NotFound, PageHeader, SectionTitle } from '../components/ui';
import { Checkbox, ChipSelect, FormActions, SelectInput, TextArea, TextInput } from '../components/form';
import { CONCERNS, ROLES } from '../lib/labels';
import { fmtDate, todayISO } from '../lib/dates';
import { toast } from '../stores/toast';
import type { ClientDogRelationship, Dog, RelationshipRole } from '../lib/types';

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').or(z.literal('')).optional();

export const dogSchema = z.object({
  name: z.string().trim().min(1, 'Every dog needs a name.').max(80),
  breed: z.string().trim().max(120).optional(),
  sex: z.enum(['female', 'male', 'unknown']),
  altered: z.boolean().optional(),
  birthDate: optionalDate,
  ageNote: z.string().max(80).optional(),
  weightLbs: z.union([z.coerce.number().positive('Weight must be positive').max(250), z.literal('')]).optional(),
  coat: z.string().max(120).optional(),
  householdId: z.string().min(1, 'Choose a household.'),
  acquisition: z.string().max(120).optional(),
  acquisitionDate: optionalDate,
  rescueOrg: z.string().max(200).optional(),
  vetClinic: z.string().max(200).optional(),
  concerns: z.array(z.string()),
  safetyNotes: z.array(z.object({ level: z.enum(['caution', 'important']), text: z.string().trim().min(1, 'Describe the safety note or remove it.').max(500) })),
  summary: z.string().max(5000).optional(),
  status: z.enum(['active', 'paused', 'graduated', 'archived']),
});

export type DogFormValues = z.input<typeof dogSchema>;

export function toDogRecord(v: z.output<typeof dogSchema>): Omit<Dog, keyof import('../lib/types').RecordMeta> {
  return {
    name: v.name,
    breed: v.breed || undefined,
    sex: v.sex,
    altered: v.altered ?? false,
    birthDate: v.birthDate || undefined,
    ageNote: v.ageNote || undefined,
    weightLbs: v.weightLbs === '' || v.weightLbs === undefined ? undefined : Number(v.weightLbs),
    coat: v.coat || undefined,
    householdId: v.householdId,
    acquisition: v.acquisition || undefined,
    acquisitionDate: v.acquisitionDate || undefined,
    rescueOrg: v.rescueOrg || undefined,
    vetClinic: v.vetClinic || undefined,
    concerns: v.concerns,
    safetyNotes: v.safetyNotes,
    summary: v.summary || undefined,
    status: v.status,
  };
}

export const ACQUISITION = ['Rescue or shelter', 'Foster (current)', 'Breeder', 'Previous owner / rehome', 'Found as a stray', 'Other'];

/** Dog fields shared by the dog form and the new-client intake. */
export function DogFields({ form, showHousehold = true }: { form: ReturnType<typeof useForm<DogFormValues>>; showHousehold?: boolean }) {
  const { register, control, formState } = form;
  const e = formState.errors;
  const households = usePractice((s) => s.households);
  const safety = useFieldArray({ control, name: 'safetyNotes' });
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Name" required error={e.name?.message} {...register('name')} />
        <TextInput label="Breed or mix" {...register('breed')} />
        <SelectInput label="Sex" options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'unknown', label: 'Unknown' }]} {...register('sex')} />
        <div className="flex items-end pb-2.5">
          <Controller control={control} name="altered" render={({ field }) => <Checkbox label="Spayed / neutered" checked={!!field.value} onChange={(ev) => field.onChange(ev.target.checked)} />} />
        </div>
        <TextInput label="Birthday" type="date" hint="Exact or estimated" error={e.birthDate?.message} {...register('birthDate')} />
        <TextInput label="Age note" hint="If the birthday is unknown, e.g. “about 3”" {...register('ageNote')} />
        <TextInput label="Weight (lb)" type="number" inputMode="decimal" step="0.1" error={e.weightLbs?.message} {...register('weightLbs')} />
        <TextInput label="Coat & markings" {...register('coat')} />
      </div>
      {showHousehold ? (
        <SelectInput
          label="Household"
          required
          error={e.householdId?.message}
          placeholder="Choose household"
          options={households.map((h) => ({ value: h.id, label: h.name }))}
          {...register('householdId')}
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Came from" placeholder="—" options={ACQUISITION.map((a) => ({ value: a, label: a }))} {...register('acquisition')} />
        <TextInput label="Joined the family" type="date" error={e.acquisitionDate?.message} {...register('acquisitionDate')} />
        <TextInput label="Rescue organization" {...register('rescueOrg')} />
        <TextInput label="Veterinarian" {...register('vetClinic')} />
      </div>
      <Controller control={control} name="concerns" render={({ field }) => <ChipSelect legend="Primary concerns" hint="Tags for finding and grouping dogs. Not a diagnosis." options={CONCERNS} value={field.value} onChange={field.onChange} />} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-olive">Safety notes</legend>
        <p className="-mt-1 text-xs text-fg-muted">Shown at the top of the dog’s profile as “Know before you meet”. Private; never added to client reports unless you choose.</p>
        {safety.fields.map((f, i) => (
          <div key={f.id} className="flex flex-col gap-2 rounded-2xl border border-clay/20 bg-clay-soft/30 p-3 sm:flex-row sm:items-start">
            <select aria-label="Safety level" className="h-11 rounded-control border border-line bg-white px-3 text-sm sm:w-36" {...register(`safetyNotes.${i}.level`)}>
              <option value="caution">Caution</option>
              <option value="important">Important</option>
            </select>
            <div className="flex-1">
              <input aria-label="Safety note" className="h-11 w-full rounded-control border border-line bg-white px-3.5 text-[0.9375rem]" placeholder="e.g. Do not reach over her head; let her approach" {...register(`safetyNotes.${i}.text`)} />
              {e.safetyNotes?.[i]?.text ? <p className="mt-1 text-sm text-clay">{e.safetyNotes[i]!.text!.message}</p> : null}
            </div>
            <Button variant="ghost" size="sm" onClick={() => safety.remove(i)} aria-label="Remove safety note">
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" className="w-fit" onClick={() => safety.append({ level: 'caution', text: '' })}>
          <Plus className="size-4" aria-hidden />
          Add safety note
        </Button>
      </fieldset>

      <TextArea label="In brief" hint="A few sentences you’d want to reread before a session." rows={3} {...register('summary')} />
    </div>
  );
}

export function DogFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { dogs, clients, links } = usePractice();
  const existing = id ? dogs.find((d) => d.id === id) : undefined;
  const presetClient = clients.find((c) => c.id === params.get('client'));

  const form = useForm<DogFormValues>({
    resolver: zodResolver(dogSchema),
    defaultValues: existing
      ? { ...existing, weightLbs: existing.weightLbs ?? '', breed: existing.breed ?? '', birthDate: existing.birthDate ?? '', acquisitionDate: existing.acquisitionDate ?? '' }
      : { name: '', sex: 'unknown', concerns: [], safetyNotes: [], status: 'active', householdId: presetClient?.householdId ?? '' },
  });

  if (id && !existing) return <NotFound what="Dog" back={{ to: '/dogs', label: 'Dogs' }} />;

  const onSubmit = form.handleSubmit(async (raw) => {
    const values = dogSchema.parse(raw);
    try {
      const w = batchWriter();
      if (existing) {
        w.update<Dog>('dogs', existing.id, toDogRecord(values));
        await w.commit();
        toast(`${values.name} updated`);
        navigate(`/dogs/${existing.id}`);
      } else {
        const dogId = w.create<Dog>('dogs', toDogRecord(values));
        // Link the dog to the people in its household (or the preset client).
        const people = presetClient ? [presetClient] : clients.filter((c) => c.householdId === values.householdId && !c.archived);
        people.forEach((c, i) =>
          w.create<ClientDogRelationship>('clientDogs', { clientId: c.id, dogId, role: 'guardian', isPrimary: i === 0, startDate: values.acquisitionDate || todayISO(), endDate: null }),
        );
        await w.commit();
        toast(`${values.name} added`);
        navigate(`/dogs/${dogId}`);
      }
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  });

  return (
    <div>
      <PageHeader title={existing ? `Edit ${existing.name}` : 'Add a dog'} back={existing ? { to: `/dogs/${existing.id}`, label: existing.name } : { to: '/dogs', label: 'Dogs' }} />
      <form onSubmit={onSubmit} noValidate>
        <Card className="p-5 sm:p-6">
          <DogFields form={form} />
          {existing ? (
            <div className="mt-5">
              <SelectInput
                label="Status"
                options={[
                  { value: 'active', label: 'Working together' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'graduated', label: 'Graduated' },
                  { value: 'archived', label: 'Archived' },
                ]}
                {...form.register('status')}
              />
            </div>
          ) : null}
        </Card>
        {existing ? <RelationshipEditor dog={existing} links={links.filter((l) => l.dogId === existing.id)} /> : null}
        <FormActions>
          {existing && !existing.archived ? (
            <Button
              variant="ghost"
              className="me-auto text-clay"
              onClick={async () => {
                if (!confirm(`Archive ${existing.name}? Their history is kept and can be restored.`)) return;
                await updateRecord<Dog>('dogs', existing.id, { archived: true, status: 'archived' });
                toast(`${existing.name} archived`);
                navigate('/dogs');
              }}
            >
              <Archive className="size-4" aria-hidden />
              Archive
            </Button>
          ) : null}
          {existing?.archived ? (
            <Button variant="ghost" className="me-auto" onClick={async () => { await updateRecord<Dog>('dogs', existing.id, { archived: false, status: 'active' }); toast('Restored'); }}>
              Restore
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" busy={form.formState.isSubmitting}>
            {existing ? 'Save changes' : 'Add dog'}
          </Button>
        </FormActions>
      </form>
    </div>
  );
}

function RelationshipEditor({ dog, links }: { dog: Dog; links: ClientDogRelationship[] }) {
  const clients = usePractice((s) => s.clients);
  const [clientId, setClientId] = useState('');
  const [role, setRole] = useState<RelationshipRole>('guardian');
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const linkedIds = new Set(links.filter((l) => !l.endDate).map((l) => l.clientId));

  const add = async () => {
    if (!clientId) return;
    try {
      const w = batchWriter();
      w.create<ClientDogRelationship>('clientDogs', { clientId, dogId: dog.id, role, isPrimary: links.filter((l) => !l.endDate).length === 0, startDate: todayISO(), endDate: null });
      await w.commit();
      setClientId('');
      toast('Person linked');
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  };

  return (
    <Card className="mt-5 p-5 sm:p-6">
      <SectionTitle>People</SectionTitle>
      <p className="mb-4 text-sm text-fg-muted">Ending a relationship keeps it in the history (rehoming, fosters, separations).</p>
      <ul className="mb-4 flex flex-col divide-y divide-line">
        {links.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className={l.endDate ? 'text-fg-muted' : ''}>
              <span className="font-semibold">{clientName(clientMap.get(l.clientId))}</span> · {l.role}
              {l.isPrimary ? ' · primary' : ''}
              <span className="block text-xs text-fg-muted">
                {fmtDate(l.startDate)} – {l.endDate ? fmtDate(l.endDate) : 'present'}
              </span>
            </span>
            {!l.endDate ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!confirm('End this relationship as of today?')) return;
                  await updateRecord<ClientDogRelationship>('clientDogs', l.id, { endDate: todayISO(), isPrimary: false });
                  toast('Relationship ended');
                }}
              >
                End
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <SelectInput
          wrapClass="flex-1"
          label="Add a person"
          placeholder="Choose client"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          options={clients.filter((c) => !linkedIds.has(c.id) && !c.archived).map((c) => ({ value: c.id, label: clientName(c) }))}
        />
        <SelectInput label="Role" value={role} onChange={(e) => setRole(e.target.value as RelationshipRole)} options={ROLES.filter((r) => r !== 'former guardian').map((r) => ({ value: r, label: r }))} />
        <Button variant="secondary" onClick={add} disabled={!clientId}>
          Link
        </Button>
      </div>
    </Card>
  );
}
