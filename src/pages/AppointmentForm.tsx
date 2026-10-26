import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@mwilliams/ui';
import { NotebookPen } from 'lucide-react';
import { createRecord, friendlyError, updateRecord, useRecord } from '../lib/db';
import { usePractice, clientName, currentLinksForDog } from '../stores/practice';
import { Button, ButtonLink, Card, Loading, NotFound, PageHeader } from '../components/ui';
import { FormActions, SelectInput, TextArea, TextInput } from '../components/form';
import { DogAvatar } from '../components/DogAvatar';
import { CONSULT_TYPE, APPT_STATUS } from '../lib/labels';
import { isoDateOffset, toISODateTime } from '../lib/dates';
import { toast } from '../stores/toast';
import { format, parseISO } from 'date-fns';
import type { Appointment } from '../lib/types';

const schema = z
  .object({
    dogIds: z.array(z.string()),
    clientId: z.string().optional(),
    type: z.enum(['initial', 'followUp', 'virtual', 'checkIn', 'discoveryCall']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.'),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a time.'),
    durationMinutes: z.coerce.number().int().min(5, 'At least 5 minutes').max(600),
    location: z.string().max(300).optional(),
    notes: z.string().max(5000).optional(),
    status: z.enum(['scheduled', 'completed', 'cancelled', 'noShow']),
  })
  .refine((v) => v.dogIds.length > 0 || !!v.clientId, { message: 'Choose a dog or a client.', path: ['dogIds'] });

type Values = z.input<typeof schema>;

export function AppointmentFormPage() {
  const { id } = useParams();
  const existing = useRecord<Appointment>('appointments', id);
  if (id && existing.loading) return <Loading />;
  if (id && !existing.data) return <NotFound what="Appointment" back={{ to: '/schedule', label: 'Schedule' }} />;
  return <AppointmentForm key={id ?? 'new'} existing={existing.data ?? undefined} />;
}

function AppointmentForm({ existing }: { existing?: Appointment }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { dogs, clients, links } = usePractice();
  const presetDog = params.get('dog');
  const presetType = params.get('type') as Values['type'] | null;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          dogIds: existing.dogIds,
          clientId: existing.clientIds[0] ?? '',
          type: existing.type,
          date: format(parseISO(existing.start), 'yyyy-MM-dd'),
          time: format(parseISO(existing.start), 'HH:mm'),
          durationMinutes: existing.durationMinutes,
          location: existing.location ?? '',
          notes: existing.notes ?? '',
          status: existing.status,
        }
      : {
          dogIds: presetDog ? [presetDog] : [],
          clientId: params.get('client') ?? '',
          type: presetType ?? 'followUp',
          date: isoDateOffset(1),
          time: '10:00',
          durationMinutes: presetType === 'discoveryCall' ? 20 : 60,
          status: 'scheduled',
        },
  });
  const { register, control, formState, watch } = form;

  const onSubmit = form.handleSubmit(async (raw) => {
    const v = schema.parse(raw);
    const fromDogs = v.dogIds.flatMap((d) => currentLinksForDog(links, d).map((l) => l.clientId));
    const record = {
      dogIds: v.dogIds,
      clientIds: [...new Set([...(v.clientId ? [v.clientId] : []), ...fromDogs])],
      type: v.type,
      start: toISODateTime(v.date, v.time),
      durationMinutes: v.durationMinutes,
      location: v.location || undefined,
      notes: v.notes || undefined,
      status: v.status,
      consultationId: existing?.consultationId ?? null,
    };
    try {
      if (existing) await updateRecord<Appointment>('appointments', existing.id, record);
      else await createRecord<Appointment>('appointments', record);
      toast(existing ? 'Appointment updated' : 'Appointment scheduled');
      navigate('/schedule');
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  });

  return (
    <div>
      <PageHeader
        title={existing ? CONSULT_TYPE[existing.type] : 'New appointment'}
        back={{ to: '/schedule', label: 'Schedule' }}
        actions={
          existing?.status === 'scheduled' && existing.type !== 'discoveryCall' ? (
            <ButtonLink to={`/sessions/new?appointment=${existing.id}`} size="sm">
              <NotebookPen className="size-4" aria-hidden />
              Start session notes
            </ButtonLink>
          ) : existing?.consultationId ? (
            <ButtonLink to={`/sessions/${existing.consultationId}`} size="sm" variant="secondary">
              Open session notes
            </ButtonLink>
          ) : null
        }
      />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Card className="flex flex-col gap-5 p-5 sm:p-6">
          <Controller
            control={control}
            name="dogIds"
            render={({ field }) => (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Dog(s)</legend>
                <div className="-mx-1 flex max-h-44 flex-wrap gap-2 overflow-y-auto px-1 py-1">
                  {dogs
                    .filter((d) => !d.archived)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((d) => {
                      const on = field.value.includes(d.id);
                      return (
                        <label key={d.id} className={cn('inline-flex cursor-pointer items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-moss/40', on ? 'border-moss bg-moss text-paper' : 'border-line bg-white')}>
                          <input type="checkbox" className="sr-only" checked={on} onChange={() => field.onChange(on ? field.value.filter((x) => x !== d.id) : [...field.value, d.id])} />
                          <DogAvatar dog={d} size="sm" className="size-7 rounded-full text-sm" />
                          {d.name}
                        </label>
                      );
                    })}
                </div>
                {formState.errors.dogIds ? <p className="mt-1 text-sm text-clay">{formState.errors.dogIds.message}</p> : null}
              </fieldset>
            )}
          />
          <SelectInput label="Client" hint="For calls before a dog is on file" placeholder="—" options={clients.filter((c) => !c.archived).sort((a, b) => a.lastName.localeCompare(b.lastName)).map((c) => ({ value: c.id, label: clientName(c) }))} {...register('clientId')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectInput wrapClass="sm:col-span-3" label="Type" options={(Object.keys(CONSULT_TYPE) as (keyof typeof CONSULT_TYPE)[]).map((t) => ({ value: t, label: CONSULT_TYPE[t] }))} {...register('type')} />
            <TextInput label="Date" type="date" required error={formState.errors.date?.message} {...register('date')} />
            <TextInput label="Time" type="time" required error={formState.errors.time?.message} {...register('time')} />
            <TextInput label="Minutes" type="number" inputMode="numeric" error={formState.errors.durationMinutes?.message} {...register('durationMinutes')} />
          </div>
          <TextInput label="Location" placeholder={watch('type') === 'virtual' ? 'Video link or “Zoom”' : 'Home, park, address'} {...register('location')} />
          <TextArea label="Notes" rows={2} {...register('notes')} />
          {existing ? <SelectInput label="Status" options={(Object.keys(APPT_STATUS) as (keyof typeof APPT_STATUS)[]).map((s) => ({ value: s, label: APPT_STATUS[s] }))} {...register('status')} /> : null}
        </Card>
        <FormActions>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" busy={formState.isSubmitting}>
            {existing ? 'Save' : 'Schedule'}
          </Button>
        </FormActions>
      </form>
    </div>
  );
}
