import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Archive } from 'lucide-react';
import { usePractice } from '../stores/practice';
import { batchWriter, friendlyError, updateRecord } from '../lib/db';
import { Button, Card, NotFound, PageHeader, PrivateLabel, SectionTitle } from '../components/ui';
import { FormActions, SelectInput, TextArea, TextInput } from '../components/form';
import { DogFields, dogSchema, toDogRecord, type DogFormValues } from './DogForm';
import { todayISO } from '../lib/dates';
import { toast } from '../stores/toast';
import type { Client, ClientDogRelationship, Dog, FollowUp, Household, RecordMeta } from '../lib/types';
import { isoDateOffset } from '../lib/dates';

export const clientSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().max(80),
  pronouns: z.string().max(40).optional(),
  email: z.string().trim().email('Enter a valid email or leave it blank.').or(z.literal('')).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d()\-.\s]{7,20}$/, 'Enter a valid phone number or leave it blank.')
    .or(z.literal(''))
    .optional(),
  preferredContact: z.enum(['text', 'call', 'email']),
  bestTimes: z.string().max(200).optional(),
  communicationNotes: z.string().max(2000).optional(),
  status: z.enum(['inquiry', 'new', 'active', 'inactive', 'returning']),
  referralSource: z.string().max(200).optional(),
  notes: z.string().max(20000).optional(),
  privateNotes: z.string().max(20000).optional(),
  inquiryDate: z.string().optional(),
  inquirySummary: z.string().max(5000).optional(),
});

const householdSchema = z.object({
  mode: z.enum(['new', 'existing']),
  existingId: z.string().optional(),
  name: z.string().max(120).optional(),
  neighborhood: z.string().max(120).optional(),
  address: z.string().max(300).optional(),
  homeType: z.string().max(120).optional(),
  accessNotes: z.string().max(1000).optional(),
  otherAnimals: z.string().max(2000).optional(),
  members: z.array(z.object({ name: z.string().trim().min(1, 'Name required').max(80), relationship: z.string().max(80) })),
});

type ClientValues = z.input<typeof clientSchema>;
type HouseholdValues = z.input<typeof householdSchema>;

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? undefined : v])) as T;
}

function ClientFields({ form, inquiry }: { form: UseFormReturn<ClientValues>; inquiry?: boolean }) {
  const { register, formState } = form;
  const e = formState.errors;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="First name" required autoComplete="off" error={e.firstName?.message} {...register('firstName')} />
        <TextInput label="Last name" autoComplete="off" error={e.lastName?.message} {...register('lastName')} />
        <TextInput label="Phone" type="tel" inputMode="tel" error={e.phone?.message} {...register('phone')} />
        <TextInput label="Email" type="email" error={e.email?.message} {...register('email')} />
        <SelectInput label="Prefers" options={[{ value: 'text', label: 'Text' }, { value: 'call', label: 'Phone call' }, { value: 'email', label: 'Email' }]} {...register('preferredContact')} />
        <TextInput label="Best times to reach" {...register('bestTimes')} />
        <TextInput label="Pronouns" {...register('pronouns')} />
        <TextInput label="Referred by" hint="Rescue, vet, friend, Instagram…" {...register('referralSource')} />
      </div>
      {inquiry ? (
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <TextInput label="Inquiry date" type="date" {...register('inquiryDate')} />
          <TextArea label="What they reached out about" rows={2} {...register('inquirySummary')} />
        </div>
      ) : null}
      <TextArea label="Communication preferences" hint="E.g. “Text first, works nights, partner handles scheduling”" rows={2} {...register('communicationNotes')} />
    </div>
  );
}

function HouseholdFields({ form, allowExisting }: { form: UseFormReturn<HouseholdValues>; allowExisting: boolean }) {
  const { register, watch, control, formState } = form;
  const households = usePractice((s) => s.households);
  const members = useFieldArray({ control, name: 'members' });
  const mode = watch('mode');
  return (
    <div className="flex flex-col gap-4">
      {allowExisting ? (
        <SelectInput label="Household" options={[{ value: 'new', label: 'New household' }, { value: 'existing', label: 'Join an existing household' }]} {...register('mode')} />
      ) : null}
      {mode === 'existing' ? (
        <SelectInput label="Existing household" placeholder="Choose" options={households.map((h) => ({ value: h.id, label: h.name }))} {...register('existingId')} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Household name" hint="Defaults to “Last name household”" {...register('name')} />
            <TextInput label="Neighborhood" hint="E.g. Astoria, Park Slope" {...register('neighborhood')} />
            <TextInput label="Address" wrapClass="sm:col-span-2" {...register('address')} />
            <SelectInput
              label="Home"
              placeholder="—"
              options={['Apartment — elevator building', 'Apartment — walk-up', 'Townhouse / brownstone', 'House with yard', 'Other'].map((v) => ({ value: v, label: v }))}
              {...register('homeType')}
            />
            <TextInput label="Access notes" hint="Buzzer, doorman, stairs" {...register('accessNotes')} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-olive">Other household members</legend>
            {members.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <input aria-label="Member name" placeholder="Name" className="h-11 flex-1 rounded-control border border-line bg-white px-3.5" {...register(`members.${i}.name`)} />
                <input aria-label="Relationship" placeholder="Partner, child (7)…" className="h-11 flex-1 rounded-control border border-line bg-white px-3.5" {...register(`members.${i}.relationship`)} />
                <Button variant="ghost" size="sm" onClick={() => members.remove(i)} aria-label="Remove member">
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            {formState.errors.members ? <p className="text-sm text-clay">Each member needs a name.</p> : null}
            <Button variant="secondary" size="sm" className="w-fit" onClick={() => members.append({ name: '', relationship: '' })}>
              <Plus className="size-4" aria-hidden />
              Add member
            </Button>
          </fieldset>
          <TextInput label="Other animals" hint="Cats, other dogs not in training…" {...register('otherAnimals')} />
        </>
      )}
    </div>
  );
}

/** New client intake: client, household and (optionally) their dog in one step. */
export function IntakePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inquiry = params.get('inquiry') === '1';
  const clientForm = useForm<ClientValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { firstName: '', lastName: '', preferredContact: 'text', status: inquiry ? 'inquiry' : 'new', inquiryDate: inquiry ? todayISO() : undefined },
  });
  const hhForm = useForm<HouseholdValues>({ resolver: zodResolver(householdSchema), defaultValues: { mode: 'new', members: [] } });
  const dogForm = useForm<DogFormValues>({
    resolver: zodResolver(dogSchema),
    defaultValues: { name: '', sex: 'unknown', concerns: [], safetyNotes: [], status: 'active', householdId: 'pending' },
  });
  const includeDog = dogForm.watch('name') !== '' || !inquiry;

  const submit = async () => {
    const okClient = await clientForm.trigger();
    const okHh = await hhForm.trigger();
    const okDog = includeDog ? await dogForm.trigger() : true;
    if (!okClient || !okHh || !okDog) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const c = clean(clientSchema.parse(clientForm.getValues()));
    const h = householdSchema.parse(hhForm.getValues());
    if (h.mode === 'existing' && !h.existingId) {
      hhForm.setError('existingId', { message: 'Choose a household' });
      return;
    }
    try {
      const w = batchWriter();
      const householdId =
        h.mode === 'existing'
          ? h.existingId!
          : w.create<Household>('households', clean({
              name: h.name?.trim() || `${c.lastName || c.firstName} household`,
              neighborhood: h.neighborhood,
              address: h.address,
              homeType: h.homeType,
              accessNotes: h.accessNotes,
              otherAnimals: h.otherAnimals,
              members: h.members,
            }));
      const clientId = w.create<Client>('clients', { ...c, householdId } as Omit<Client, keyof RecordMeta>);
      let dogId: string | null = null;
      if (includeDog) {
        const d = dogSchema.parse({ ...dogForm.getValues(), householdId });
        dogId = w.create<Dog>('dogs', toDogRecord(d));
        w.create<ClientDogRelationship>('clientDogs', { clientId, dogId, role: 'guardian', isPrimary: true, startDate: d.acquisitionDate || todayISO(), endDate: null });
      }
      if (c.status === 'inquiry') {
        w.create<FollowUp>('followUps', { title: `Reply to ${c.firstName}’s inquiry`, dueDate: isoDateOffset(1), status: 'open', clientId, dogId, notes: c.inquirySummary });
      }
      await w.commit();
      toast(dogId ? `${c.firstName} and ${dogForm.getValues('name')} added` : `${c.firstName} added`);
      navigate(dogId && !inquiry ? `/dogs/${dogId}` : `/clients/${clientId}`);
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  };

  return (
    <div>
      <PageHeader title={inquiry ? 'Log an inquiry' : 'New client'} eyebrow={inquiry ? 'Someone reached out' : 'Intake'} back={{ to: '/clients', label: 'Clients' }} />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-5"
      >
        <Card className="p-5 sm:p-6">
          <SectionTitle>Person</SectionTitle>
          <ClientFields form={clientForm} inquiry={inquiry} />
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle>Home</SectionTitle>
          <HouseholdFields form={hhForm} allowExisting />
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle>Dog{inquiry ? ' (optional)' : ''}</SectionTitle>
          <DogFields form={dogForm} showHousehold={false} />
        </Card>
        <FormActions>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" busy={clientForm.formState.isSubmitting}>
            {inquiry ? 'Save inquiry' : 'Create client'}
          </Button>
        </FormActions>
      </form>
    </div>
  );
}

export function ClientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, households } = usePractice();
  const client = clients.find((c) => c.id === id);
  const household = households.find((h) => h.id === client?.householdId);
  const clientForm = useForm<ClientValues>({ resolver: zodResolver(clientSchema), defaultValues: client ? { ...client } : undefined });
  const hhForm = useForm<HouseholdValues>({
    resolver: zodResolver(householdSchema),
    defaultValues: { mode: 'new', ...household, members: household?.members.map((m) => ({ name: m.name, relationship: m.relationship })) ?? [] },
  });

  if (!client) return <NotFound what="Client" back={{ to: '/clients', label: 'Clients' }} />;

  const submit = async () => {
    const ok = (await clientForm.trigger()) && (await hhForm.trigger());
    if (!ok) return;
    const c = clean(clientSchema.parse(clientForm.getValues()));
    const h = householdSchema.parse(hhForm.getValues());
    try {
      const w = batchWriter();
      w.update<Client>('clients', client.id, c as Partial<Client>);
      if (household) {
        w.update<Household>('households', household.id, {
          name: h.name?.trim() || household.name,
          neighborhood: h.neighborhood,
          address: h.address,
          homeType: h.homeType,
          accessNotes: h.accessNotes,
          otherAnimals: h.otherAnimals,
          members: h.members,
        });
      }
      await w.commit();
      toast('Saved');
      navigate(`/clients/${client.id}`);
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  };

  return (
    <div>
      <PageHeader title={`Edit ${client.firstName}`} back={{ to: `/clients/${client.id}`, label: `${client.firstName} ${client.lastName}` }} />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-5"
      >
        <Card className="p-5 sm:p-6">
          <SectionTitle>Person</SectionTitle>
          <ClientFields form={clientForm} inquiry={client.status === 'inquiry' || !!client.inquirySummary} />
          <div className="mt-4">
            <SelectInput
              label="Status"
              options={[
                { value: 'inquiry', label: 'Inquiry' },
                { value: 'new', label: 'New' },
                { value: 'active', label: 'Active' },
                { value: 'returning', label: 'Returning' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              {...clientForm.register('status')}
            />
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle>Notes</SectionTitle>
          <div className="flex flex-col gap-4">
            <TextArea label="Shareable notes" hint="Fine to appear in client-facing summaries." rows={3} {...clientForm.register('notes')} />
            <TextArea label="Consultant-only notes" badge={<PrivateLabel />} hint="Never included in reports or exports meant for the client." rows={3} {...clientForm.register('privateNotes')} />
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle>Household · shared with everyone in it</SectionTitle>
          <HouseholdFields form={hhForm} allowExisting={false} />
        </Card>
        <FormActions>
          {!client.archived ? (
            <Button
              variant="ghost"
              className="me-auto text-clay"
              onClick={async () => {
                if (!confirm(`Archive ${client.firstName}? History is kept and can be restored.`)) return;
                await updateRecord<Client>('clients', client.id, { archived: true, status: 'inactive' });
                toast('Client archived');
                navigate('/clients');
              }}
            >
              <Archive className="size-4" aria-hidden />
              Archive
            </Button>
          ) : (
            <Button variant="ghost" className="me-auto" onClick={async () => { await updateRecord<Client>('clients', client.id, { archived: false, status: 'returning' }); toast('Restored'); }}>
              Restore
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit">Save changes</Button>
        </FormActions>
      </form>
    </div>
  );
}
