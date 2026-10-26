// The Master Behavioral Assessment. This is the starting template that is
// seeded into Firestore; after that Haley edits it in Settings → Assessment
// template, and every published edit becomes a new immutable version.
//
// These are structured information-gathering prompts, not a diagnostic tool:
// there are no severity scores, and nothing here produces a conclusion.

import type { Question, TemplateDefinition, TemplateSection } from '../lib/types';

const q = (id: string, label: string, type: Question['type'], extra: Partial<Question> = {}): Question => ({
  id,
  label,
  type,
  source: 'reported',
  ...extra,
});

const yes = (questionId: string) => ({ questionId, operator: 'equals' as const, value: 'yes' });

const sections: TemplateSection[] = [
  {
    id: 'household',
    title: 'Dog & household',
    description: 'Who this dog is, where they came from, and what a normal day looks like.',
    questions: [
      q('hh_reason_name', 'What does the family call this dog day to day?', 'text', { help: 'Nicknames, cues that sound like their name.' }),
      q('hh_acquired_from', 'Where did the dog come from?', 'singleChoice', {
        options: ['Rescue or shelter', 'Foster (current)', 'Breeder', 'Previous owner / rehome', 'Found as a stray', 'Other'],
        required: true,
        mode: 'initial',
      }),
      q('hh_rescue_history', 'What is known about the rescue or shelter history?', 'longText', {
        help: 'Time in shelter, transport, returns, known previous homes.',
        showIf: { questionId: 'hh_acquired_from', operator: 'equals', value: 'Rescue or shelter' },
        mode: 'initial',
      }),
      q('hh_foster_org', 'Which rescue organization is fostering, and who is the contact?', 'text', {
        showIf: { questionId: 'hh_acquired_from', operator: 'equals', value: 'Foster (current)' },
      }),
      q('hh_age_acquired', 'Age when the dog joined the household', 'text', { mode: 'initial' }),
      q('hh_members', 'Who lives in the home?', 'list', { help: 'Adults, children (with ages), regular visitors, dog walkers.', required: true }),
      q('hh_children', 'Are there children in the home or visiting regularly?', 'yesNo'),
      q('hh_children_detail', 'Children’s ages and how they interact with the dog', 'longText', { showIf: yes('hh_children') }),
      q('hh_other_animals', 'Other animals in the home', 'list', { help: 'Species, names, ages, and how they get along.' }),
      q('hh_home_type', 'Living environment', 'singleChoice', {
        options: ['Apartment — elevator building', 'Apartment — walk-up', 'Townhouse / brownstone', 'House with yard', 'Other'],
        mode: 'initial',
      }),
      q('hh_environment_notes', 'Environmental details that matter', 'longText', {
        help: 'Hallways, lobby, doormen, street noise, nearby dog runs, stairs.',
      }),
      q('hh_routine', 'Typical daily routine', 'longText', { help: 'Wake, walks, meals, alone time, evening.', required: true }),
      q('hh_alone_time', 'Hours alone on a typical day', 'number', { help: 'Approximate.' }),
      q('hh_exercise', 'Exercise and outings', 'longText', { help: 'Walk length and frequency, off-leash time, dog runs, daycare.' }),
      q('hh_sleep', 'Where and how well does the dog sleep?', 'text'),
      q('hh_enrichment', 'Enrichment the dog currently enjoys', 'multiChoice', {
        options: ['Food puzzles', 'Snuffle mat / scatter feeding', 'Chews', 'Sniffaris', 'Training games', 'Play with people', 'Play with dogs', 'None yet'],
      }),
      q('hh_diet', 'Diet and feeding routine', 'text'),
    ],
  },
  {
    id: 'concerns',
    title: 'Primary concerns',
    description: 'In the client’s words: why they reached out and what they hope will change.',
    questions: [
      q('co_reason', 'What prompted them to reach out now?', 'longText', { required: true }),
      q('co_main_concerns', 'Main behavioral concerns', 'multiChoice', {
        required: true,
        options: [
          'Reactivity', 'Aggression', 'Fear or anxiety', 'Separation-related behavior', 'Resource guarding',
          'Handling / cooperative care', 'Puppy development', 'Leash walking', 'Recall', 'House training',
          'Jumping / mouthing', 'Barking', 'Multi-dog household conflict', 'Rescue transition / decompression', 'Other',
        ],
        help: 'Selecting a concern suggests the matching module below. It is not a diagnosis.',
      }),
      q('co_description', 'Describe the behavior as the client describes it', 'longText', { required: true }),
      q('co_onset', 'When did it start, and has it changed over time?', 'longText', { mode: 'initial' }),
      q('co_frequency', 'How often does it happen?', 'singleChoice', {
        options: ['Several times a day', 'Daily', 'A few times a week', 'Weekly', 'A few times a month', 'Rarely', 'Unsure'],
      }),
      q('co_duration', 'How long do episodes usually last?', 'text'),
      q('co_context', 'Where, when, and with whom does it happen?', 'longText'),
      q('co_worst_example', 'Most recent or most concerning example', 'longText'),
      q('co_goals', 'What would success look like for the client?', 'longText', { required: true, help: 'Ask for something observable: “walk past the bodega without lunging”.' }),
      q('co_priorities', 'Client’s top priorities, in order', 'list'),
      q('co_capacity', 'Time and capacity the family has for training', 'text', { help: 'Who will do the work, and how many minutes a day is realistic.' }),
      q('co_changes_since', 'What has changed since the last assessment?', 'longText', { mode: 'followUp', required: true }),
    ],
  },
  {
    id: 'medical',
    title: 'Medical & developmental',
    description: 'Health, pain, and history that can influence behavior. Refer to the vet for anything medical.',
    questions: [
      q('md_vet', 'Primary veterinarian or clinic', 'text'),
      q('md_last_exam', 'Date of last vet exam', 'date'),
      q('md_conditions', 'Known medical conditions', 'longText'),
      q('md_medications', 'Current medications or supplements', 'list', { help: 'Name, dose, and who prescribed.' }),
      q('md_behavior_meds', 'Is the dog on, or being considered for, behavior medication?', 'yesNo'),
      q('md_behavior_meds_detail', 'Behavior medication details and prescribing vet', 'longText', { showIf: yes('md_behavior_meds') }),
      q('md_pain_signs', 'Any possible signs of pain or discomfort?', 'multiChoice', {
        options: ['Limping or stiffness', 'Reluctance on stairs or jumping', 'Sensitive to touch in an area', 'Changes in appetite', 'Changes in sleep', 'GI issues', 'Skin or ear issues', 'None noticed'],
      }),
      q('md_pain_detail', 'Describe the discomfort concerns', 'longText', {
        showIf: { questionId: 'md_pain_signs', operator: 'answered' },
      }),
      q('md_vet_involved', 'Has the vet been consulted about the behavior?', 'singleChoice', {
        options: ['Yes', 'Not yet', 'Recommended', 'Not needed at this time'],
      }),
      q('md_development', 'Early life and socialization history', 'longText', { mode: 'initial', help: 'Litter, early environment, exposure to people, dogs, city life.' }),
      q('md_social_history', 'History with other dogs and people', 'longText', { mode: 'initial' }),
      q('md_previous_training', 'Previous training and approaches tried', 'longText', {
        help: 'Classes, trainers, tools (including aversive tools). Non-judgmental.',
      }),
      q('md_previous_tools', 'Equipment used now or previously', 'multiChoice', {
        options: ['Flat collar', 'Harness', 'Head halter', 'Martingale', 'Prong collar', 'Choke chain', 'E-collar', 'Basket muzzle', 'Other'],
      }),
      q('md_previous_response', 'How did the dog respond to previous training?', 'longText', { showIf: { questionId: 'md_previous_training', operator: 'answered' } }),
    ],
  },
  {
    id: 'triggers',
    title: 'Triggers & patterns',
    description: 'What sets the behavior off, and what it looks like from start to recovery.',
    questions: [
      q('tr_known', 'Known triggers', 'multiChoice', {
        source: 'either',
        options: ['Other dogs', 'Unfamiliar people', 'Familiar people', 'Children', 'Bikes / scooters', 'Cars / trucks', 'Loud noises', 'Being handled', 'Being approached while resting', 'Food or objects', 'Door / visitors', 'Being left alone', 'Vet or grooming', 'Other'],
      }),
      q('tr_other', 'Other or more specific triggers', 'longText', { source: 'either' }),
      q('tr_contexts', 'Environmental contexts where it is more likely', 'longText', { help: 'Narrow sidewalks, lobby, elevator, evenings, after visitors.', source: 'either' }),
      q('tr_distance', 'Approximate distance at which the dog starts responding', 'text', { source: 'either', help: 'E.g. “half a block”, “across the street is okay”.' }),
      q('tr_intensity_factors', 'What makes it more or less intense?', 'longText', { source: 'either', help: 'Describe in words; no scores.' }),
      q('tr_body_language', 'Body language seen before and during', 'multiChoice', {
        source: 'either',
        options: ['Freezing / stillness', 'Hard stare', 'Whale eye', 'Lip licking', 'Yawning', 'Ears pinned back', 'Ears forward', 'Tail tucked', 'Tail high and stiff', 'Raised hackles', 'Weight shifted forward', 'Weight shifted back', 'Growling', 'Lip lift / snarl', 'Barking', 'Lunging', 'Air snap', 'Trembling', 'Avoidance / turning away'],
      }),
      q('tr_response', 'What does the dog do, step by step?', 'longText', { source: 'either' }),
      q('tr_recovery', 'How long does it take the dog to settle afterward, and what helps?', 'longText', { source: 'either' }),
      q('tr_antecedents', 'What usually happens right before? (antecedents)', 'longText', { source: 'either' }),
      q('tr_consequences', 'What usually happens right after? (consequences)', 'longText', {
        source: 'either',
        help: 'How people respond, what the dog gets or avoids.',
      }),
      q('tr_predictability', 'How predictable is the behavior?', 'singleChoice', {
        options: ['Very predictable', 'Somewhat predictable', 'Unpredictable', 'Unsure'],
      }),
    ],
  },
  {
    id: 'safety',
    title: 'Safety & incidents',
    description: 'Bite history and the precautions in place. These answers stay private by default.',
    questions: [
      q('sf_bite_history', 'Any bites or attempted bites?', 'yesNo', { required: true, private: true }),
      q('sf_incidents', 'Incidents (date, who, where, what happened)', 'longText', {
        showIf: yes('sf_bite_history'),
        required: true,
        private: true,
        help: 'One incident per paragraph. Record what was seen and what was reported separately.',
      }),
      q('sf_target', 'Who or what was involved?', 'multiChoice', {
        showIf: yes('sf_bite_history'),
        private: true,
        options: ['Adult in household', 'Child in household', 'Visitor', 'Stranger', 'Another dog in household', 'Unfamiliar dog', 'Vet or groomer'],
      }),
      q('sf_injury', 'Injury information', 'longText', {
        showIf: yes('sf_bite_history'),
        private: true,
        help: 'Describe the injury as reported (e.g. no puncture, bruising, puncture, medical attention).',
      }),
      q('sf_handling_risks', 'Known handling risks', 'longText', { private: true, help: 'Collar grabs, paws, picking up, nail trims, removing items.' }),
      q('sf_management', 'Management currently in place', 'multiChoice', {
        options: ['Baby gates', 'Crate', 'Separate rooms', 'Muzzle (conditioned)', 'Muzzle (not yet conditioned)', 'Leash in the house', 'Walk at quiet times', 'Visitors restricted', 'None yet'],
      }),
      q('sf_precautions', 'Safety precautions recommended or agreed', 'longText', { private: true }),
      q('sf_children_risk', 'Specific precautions around children', 'longText', {
        private: true,
        showIf: yes('hh_children'),
      }),
      q('sf_referral', 'Referral considerations', 'multiChoice', {
        private: true,
        options: ['Veterinary exam', 'Veterinary behaviorist', 'Pain workup', 'Rescue organization involved', 'None at this time'],
        help: 'Record considerations, not conclusions.',
      }),
      q('sf_referral_note', 'Referral notes', 'longText', { private: true, showIf: { questionId: 'sf_referral', operator: 'answered' } }),
    ],
  },
  {
    id: 'skills',
    title: 'Learning & skills',
    description: 'What the dog already knows and what motivates them.',
    questions: [
      q('sk_cues', 'Known cues and how reliable they are', 'list', { source: 'either', help: 'Cue — where it works, where it falls apart.' }),
      q('sk_reinforcers', 'Favorite reinforcers', 'multiChoice', {
        source: 'either',
        options: ['Soft treats', 'Cheese / meat', 'Kibble', 'Toys — tug', 'Toys — fetch', 'Praise', 'Sniffing', 'Access to people', 'Access to dogs'],
      }),
      q('sk_food_motivation', 'Food interest during training', 'singleChoice', {
        source: 'either',
        options: ['Takes food readily everywhere', 'Takes food at home only', 'Picky / variable', 'Stops taking food when stressed'],
      }),
      q('sk_handling', 'Handling tolerance', 'longText', { source: 'either', help: 'Paws, ears, mouth, collar, harness on/off, brushing.' }),
      q('sk_confidence', 'Confidence in new environments', 'longText', { source: 'either' }),
      q('sk_distractions', 'Response to distractions', 'longText', { source: 'either' }),
      q('sk_progress', 'Progress on previous training', 'longText', { mode: 'followUp' }),
    ],
  },
  {
    id: 'observations',
    title: 'Consultant observations',
    description: 'What Haley saw directly, kept separate from what was reported.',
    questions: [
      q('ob_observed', 'Directly observed behavior', 'longText', { source: 'observed', required: true }),
      q('ob_reported_summary', 'Owner-reported behavior (summary)', 'longText', { source: 'reported' }),
      q('ob_environment', 'Environmental influences noticed', 'longText', { source: 'observed' }),
      q('ob_stress', 'Stress signals observed', 'multiChoice', {
        source: 'observed',
        options: ['Lip licking', 'Yawning', 'Panting (not heat related)', 'Pacing', 'Scanning', 'Shake-offs', 'Sniffing displacement', 'Avoidance', 'Freezing', 'Vocalizing', 'None observed'],
      }),
      q('ob_hypotheses', 'Working hypotheses', 'longText', {
        source: 'observed',
        private: true,
        help: 'Tentative explanations to test, not conclusions.',
      }),
      q('ob_further', 'Areas needing further assessment', 'longText', { source: 'observed' }),
      q('ob_handler', 'Handler skills and relationship notes', 'longText', { source: 'observed', private: true }),
    ],
  },
  {
    id: 'recommendations',
    title: 'Recommendations',
    description: 'What happens next: management, goals, and homework.',
    questions: [
      q('rc_management', 'Immediate management recommendations', 'longText', { source: 'observed', required: true }),
      q('rc_goals', 'Prioritized goals', 'list', { source: 'observed', required: true }),
      q('rc_exercises', 'Suggested exercises', 'list', { source: 'observed' }),
      q('rc_homework', 'Client homework', 'longText', { source: 'observed' }),
      q('rc_followup', 'Follow-up needs', 'singleChoice', {
        source: 'observed',
        options: ['Follow-up session in 1 week', 'Follow-up session in 2 weeks', 'Email check-in', 'As needed', 'Referral first'],
      }),
      q('rc_success', 'Observable success criteria', 'list', {
        source: 'observed',
        help: 'What will we see when this is working? E.g. “Eats treats on the sidewalk with dogs across the street.”',
      }),
    ],
  },
];

const modules: TemplateSection[] = [
  {
    id: 'mod_reactivity',
    title: 'Reactivity',
    suggestedFor: ['Reactivity'],
    questions: [
      q('re_targets', 'Reactive toward', 'multiChoice', { source: 'either', options: ['Dogs on leash', 'Dogs off leash', 'People', 'Bikes / scooters', 'Vehicles', 'Animals (squirrels, cats)'] }),
      q('re_leash_only', 'Does it happen only on leash?', 'singleChoice', { options: ['Only on leash', 'On and off leash', 'Unsure'] }),
      q('re_threshold', 'Where does the dog cope well? (distance, setting)', 'longText', { source: 'either' }),
      q('re_routes', 'Typical walking routes and problem spots', 'longText'),
      q('re_hallway', 'Building/hallway encounters', 'longText', { showIf: { questionId: 'hh_home_type', operator: 'includes', value: 'Apartment' } }),
      q('re_redirect', 'Has the dog redirected onto the leash or handler?', 'yesNo', { private: true }),
      q('re_redirect_detail', 'Redirection details', 'longText', { private: true, showIf: yes('re_redirect') }),
    ],
  },
  {
    id: 'mod_aggression',
    title: 'Aggression',
    suggestedFor: ['Aggression', 'Multi-dog household conflict'],
    questions: [
      q('ag_context', 'Contexts where aggressive behavior has occurred', 'multiChoice', {
        options: ['Resting places', 'Food / chews', 'Handling', 'Visitors entering', 'On walks', 'Toward other dogs at home', 'When startled', 'When restrained'],
        private: true,
      }),
      q('ag_warning', 'Warning signals the dog gives before escalating', 'longText', { source: 'either', private: true }),
      q('ag_warning_suppressed', 'Have warnings ever been punished?', 'yesNo', { private: true }),
      q('ag_inhibition', 'Description of bite inhibition (as reported)', 'longText', { private: true }),
      q('ag_multi_dog', 'Conflict between dogs in the home', 'longText', { showIf: { questionId: 'co_main_concerns', operator: 'includes', value: 'Multi-dog household conflict' }, private: true }),
      q('ag_muzzle', 'Muzzle conditioning status', 'singleChoice', { options: ['Comfortable wearing', 'In progress', 'Not started', 'Not recommended at this time'] }),
    ],
  },
  {
    id: 'mod_fear',
    title: 'Fear & anxiety',
    suggestedFor: ['Fear or anxiety', 'Rescue transition / decompression'],
    questions: [
      q('fe_fears', 'Things the dog is afraid of', 'list', { source: 'either' }),
      q('fe_coping', 'Coping strategy when afraid', 'multiChoice', { source: 'either', options: ['Flee / hide', 'Freeze', 'Fidget / appease', 'Fight / bark', 'Shut down'] }),
      q('fe_safe_spaces', 'Safe spaces and comfort strategies', 'longText'),
      q('fe_noise', 'Noise sensitivity (fireworks, construction, sirens)', 'longText'),
      q('fe_decompression', 'Decompression since arrival', 'longText', { showIf: { questionId: 'co_main_concerns', operator: 'includes', value: 'Rescue transition / decompression' } }),
      q('fe_generalized', 'Is the dog anxious much of the day, or in specific situations?', 'singleChoice', { options: ['Specific situations', 'Much of the day', 'Unsure'] }),
    ],
  },
  {
    id: 'mod_separation',
    title: 'Separation-related',
    suggestedFor: ['Separation-related behavior'],
    questions: [
      q('se_signs', 'Behavior when alone', 'multiChoice', { source: 'either', options: ['Vocalizing', 'Destruction near exits', 'House soiling', 'Pacing', 'Drooling / panting', 'Not eating', 'Escape attempts', 'Self-injury'] }),
      q('se_video', 'Has the dog been recorded while alone?', 'yesNo'),
      q('se_video_notes', 'What the video shows, minute by minute', 'longText', { source: 'observed', showIf: yes('se_video') }),
      q('se_onset_time', 'How soon after departure does it start?', 'text', { source: 'either' }),
      q('se_predeparture', 'Responses to pre-departure cues (keys, shoes, coat)', 'longText'),
      q('se_tolerance', 'Current comfortable alone time', 'text', { source: 'either' }),
      q('se_any_person', 'Is the dog fine with any person present?', 'singleChoice', { options: ['Yes, anyone', 'Only specific people', 'Unsure'] }),
      q('se_coverage', 'Absence-management options available', 'multiChoice', { options: ['Dog sitter', 'Daycare', 'Work from home days', 'Friends / family', 'Bring dog along', 'None yet'] }),
    ],
  },
  {
    id: 'mod_guarding',
    title: 'Resource guarding',
    suggestedFor: ['Resource guarding'],
    questions: [
      q('rg_items', 'Items or places guarded', 'multiChoice', { source: 'either', options: ['Food bowl', 'High-value chews', 'Stolen items', 'Toys', 'Resting places / furniture', 'People', 'Crate', 'Spaces / doorways'] }),
      q('rg_from', 'Guarded from', 'multiChoice', { options: ['Adults', 'Children', 'Other dogs', 'Other pets', 'Visitors'] }),
      q('rg_signs', 'Guarding signals', 'multiChoice', { source: 'either', options: ['Stiffening', 'Eating faster', 'Hard eye', 'Growling', 'Lip lift', 'Air snap', 'Bite'], private: true }),
      q('rg_trades', 'Does the dog trade items willingly?', 'singleChoice', { options: ['Yes, for most items', 'Only low-value items', 'No', 'Not tried'] }),
      q('rg_management', 'Current management around resources', 'longText'),
    ],
  },
  {
    id: 'mod_coop_care',
    title: 'Cooperative care',
    suggestedFor: ['Handling / cooperative care'],
    questions: [
      q('cc_procedures', 'Procedures that are difficult', 'multiChoice', { source: 'either', options: ['Nail trims', 'Ear cleaning', 'Eye drops', 'Tooth brushing', 'Brushing / grooming', 'Bathing', 'Vet exam', 'Injections', 'Muzzle wear', 'Harness on/off'] }),
      q('cc_vet_visits', 'How vet visits currently go', 'longText'),
      q('cc_sedation', 'Has sedation or pre-visit medication been used?', 'yesNo'),
      q('cc_consent', 'Start-button or consent behaviors already taught', 'text', { source: 'either' }),
    ],
  },
  {
    id: 'mod_puppy',
    title: 'Puppy development',
    suggestedFor: ['Puppy development', 'House training', 'Jumping / mouthing'],
    questions: [
      q('pp_age_weeks', 'Age in weeks', 'number'),
      q('pp_vaccines', 'Vaccination status and outdoor access', 'text'),
      q('pp_socialization', 'Socialization experiences so far', 'list', { help: 'People, surfaces, sounds, handling, city sights.' }),
      q('pp_house_training', 'House training progress', 'longText'),
      q('pp_mouthing', 'Mouthing and play biting', 'longText'),
      q('pp_sleep_crate', 'Crate and sleep routine', 'longText'),
      q('pp_alone_practice', 'Short alone-time practice', 'text'),
    ],
  },
];

export const MASTER_TEMPLATE: TemplateDefinition = {
  name: 'Master Behavioral Assessment',
  description: 'Good Dog’s complete intake and follow-up assessment. Edit it in Settings; every published change becomes a new version.',
  sections,
  modules,
};
