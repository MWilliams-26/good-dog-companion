# Master Behavioral Assessment

Good Dog’s complete intake and follow-up assessment. Edit it in Settings; every published change becomes a new version.

Generated from `src/assessment/masterTemplate.ts`, which seeds version 1. After that the live template is edited in the app (Settings → Assessment template) and every publish creates a new immutable version.

Every question can also be marked **Not assessed** or **Not applicable**, and can carry a note. Modules are structured prompts for gathering information, not diagnoses; nothing in the template produces a score.

8 core sections, 7 focus modules, 127 questions.

Legend: **R** required · **P** private by default (kept out of client reports) · *Initial*/*Follow-up* = shown only in that mode.

## Dog & household

Who this dog is, where they came from, and what a normal day looks like.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `hh_reason_name` | What does the family call this dog day to day? | Short text | Client reported |  |
| `hh_acquired_from` | Where did the dog come from?<br><small>Rescue or shelter · Foster (current) · Breeder · Previous owner / rehome · Found as a stray · Other</small> | Single choice | Client reported | R *Initial* |
| `hh_rescue_history` | What is known about the rescue or shelter history? — shown when `hh_acquired_from` equals “Rescue or shelter” | Paragraph | Client reported | *Initial* |
| `hh_foster_org` | Which rescue organization is fostering, and who is the contact? — shown when `hh_acquired_from` equals “Foster (current)” | Short text | Client reported |  |
| `hh_age_acquired` | Age when the dog joined the household | Short text | Client reported | *Initial* |
| `hh_members` | Who lives in the home? | List | Client reported | R |
| `hh_children` | Are there children in the home or visiting regularly? | Yes / No / Unsure | Client reported |  |
| `hh_children_detail` | Children’s ages and how they interact with the dog — shown when `hh_children` equals “yes” | Paragraph | Client reported |  |
| `hh_other_animals` | Other animals in the home | List | Client reported |  |
| `hh_home_type` | Living environment<br><small>Apartment — elevator building · Apartment — walk-up · Townhouse / brownstone · House with yard · Other</small> | Single choice | Client reported | *Initial* |
| `hh_environment_notes` | Environmental details that matter | Paragraph | Client reported |  |
| `hh_routine` | Typical daily routine | Paragraph | Client reported | R |
| `hh_alone_time` | Hours alone on a typical day | Number | Client reported |  |
| `hh_exercise` | Exercise and outings | Paragraph | Client reported |  |
| `hh_sleep` | Where and how well does the dog sleep? | Short text | Client reported |  |
| `hh_enrichment` | Enrichment the dog currently enjoys<br><small>Food puzzles · Snuffle mat / scatter feeding · Chews · Sniffaris · Training games · Play with people · Play with dogs · None yet</small> | Multiple choice | Client reported |  |
| `hh_diet` | Diet and feeding routine | Short text | Client reported |  |

## Primary concerns

In the client’s words: why they reached out and what they hope will change.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `co_reason` | What prompted them to reach out now? | Paragraph | Client reported | R |
| `co_main_concerns` | Main behavioral concerns<br><small>Reactivity · Aggression · Fear or anxiety · Separation-related behavior · Resource guarding · Handling / cooperative care · Puppy development · Leash walking · Recall · House training · Jumping / mouthing · Barking · Multi-dog household conflict · Rescue transition / decompression · Other</small> | Multiple choice | Client reported | R |
| `co_description` | Describe the behavior as the client describes it | Paragraph | Client reported | R |
| `co_onset` | When did it start, and has it changed over time? | Paragraph | Client reported | *Initial* |
| `co_frequency` | How often does it happen?<br><small>Several times a day · Daily · A few times a week · Weekly · A few times a month · Rarely · Unsure</small> | Single choice | Client reported |  |
| `co_duration` | How long do episodes usually last? | Short text | Client reported |  |
| `co_context` | Where, when, and with whom does it happen? | Paragraph | Client reported |  |
| `co_worst_example` | Most recent or most concerning example | Paragraph | Client reported |  |
| `co_goals` | What would success look like for the client? | Paragraph | Client reported | R |
| `co_priorities` | Client’s top priorities, in order | List | Client reported |  |
| `co_capacity` | Time and capacity the family has for training | Short text | Client reported |  |
| `co_changes_since` | What has changed since the last assessment? | Paragraph | Client reported | R *Follow-up* |

## Medical & developmental

Health, pain, and history that can influence behavior. Refer to the vet for anything medical.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `md_vet` | Primary veterinarian or clinic | Short text | Client reported |  |
| `md_last_exam` | Date of last vet exam | Date | Client reported |  |
| `md_conditions` | Known medical conditions | Paragraph | Client reported |  |
| `md_medications` | Current medications or supplements | List | Client reported |  |
| `md_behavior_meds` | Is the dog on, or being considered for, behavior medication? | Yes / No / Unsure | Client reported |  |
| `md_behavior_meds_detail` | Behavior medication details and prescribing vet — shown when `md_behavior_meds` equals “yes” | Paragraph | Client reported |  |
| `md_pain_signs` | Any possible signs of pain or discomfort?<br><small>Limping or stiffness · Reluctance on stairs or jumping · Sensitive to touch in an area · Changes in appetite · Changes in sleep · GI issues · Skin or ear issues · None noticed</small> | Multiple choice | Client reported |  |
| `md_pain_detail` | Describe the discomfort concerns — shown when `md_pain_signs` answered | Paragraph | Client reported |  |
| `md_vet_involved` | Has the vet been consulted about the behavior?<br><small>Yes · Not yet · Recommended · Not needed at this time</small> | Single choice | Client reported |  |
| `md_development` | Early life and socialization history | Paragraph | Client reported | *Initial* |
| `md_social_history` | History with other dogs and people | Paragraph | Client reported | *Initial* |
| `md_previous_training` | Previous training and approaches tried | Paragraph | Client reported |  |
| `md_previous_tools` | Equipment used now or previously<br><small>Flat collar · Harness · Head halter · Martingale · Prong collar · Choke chain · E-collar · Basket muzzle · Other</small> | Multiple choice | Client reported |  |
| `md_previous_response` | How did the dog respond to previous training? — shown when `md_previous_training` answered | Paragraph | Client reported |  |

## Triggers & patterns

What sets the behavior off, and what it looks like from start to recovery.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `tr_known` | Known triggers<br><small>Other dogs · Unfamiliar people · Familiar people · Children · Bikes / scooters · Cars / trucks · Loud noises · Being handled · Being approached while resting · Food or objects · Door / visitors · Being left alone · Vet or grooming · Other</small> | Multiple choice | Either (per answer) |  |
| `tr_other` | Other or more specific triggers | Paragraph | Either (per answer) |  |
| `tr_contexts` | Environmental contexts where it is more likely | Paragraph | Either (per answer) |  |
| `tr_distance` | Approximate distance at which the dog starts responding | Short text | Either (per answer) |  |
| `tr_intensity_factors` | What makes it more or less intense? | Paragraph | Either (per answer) |  |
| `tr_body_language` | Body language seen before and during<br><small>Freezing / stillness · Hard stare · Whale eye · Lip licking · Yawning · Ears pinned back · Ears forward · Tail tucked · Tail high and stiff · Raised hackles · Weight shifted forward · Weight shifted back · Growling · Lip lift / snarl · Barking · Lunging · Air snap · Trembling · Avoidance / turning away</small> | Multiple choice | Either (per answer) |  |
| `tr_response` | What does the dog do, step by step? | Paragraph | Either (per answer) |  |
| `tr_recovery` | How long does it take the dog to settle afterward, and what helps? | Paragraph | Either (per answer) |  |
| `tr_antecedents` | What usually happens right before? (antecedents) | Paragraph | Either (per answer) |  |
| `tr_consequences` | What usually happens right after? (consequences) | Paragraph | Either (per answer) |  |
| `tr_predictability` | How predictable is the behavior?<br><small>Very predictable · Somewhat predictable · Unpredictable · Unsure</small> | Single choice | Client reported |  |

## Safety & incidents

Bite history and the precautions in place. These answers stay private by default.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `sf_bite_history` | Any bites or attempted bites? | Yes / No / Unsure | Client reported | R P |
| `sf_incidents` | Incidents (date, who, where, what happened) — shown when `sf_bite_history` equals “yes” | Paragraph | Client reported | R P |
| `sf_target` | Who or what was involved? — shown when `sf_bite_history` equals “yes”<br><small>Adult in household · Child in household · Visitor · Stranger · Another dog in household · Unfamiliar dog · Vet or groomer</small> | Multiple choice | Client reported | P |
| `sf_injury` | Injury information — shown when `sf_bite_history` equals “yes” | Paragraph | Client reported | P |
| `sf_handling_risks` | Known handling risks | Paragraph | Client reported | P |
| `sf_management` | Management currently in place<br><small>Baby gates · Crate · Separate rooms · Muzzle (conditioned) · Muzzle (not yet conditioned) · Leash in the house · Walk at quiet times · Visitors restricted · None yet</small> | Multiple choice | Client reported |  |
| `sf_precautions` | Safety precautions recommended or agreed | Paragraph | Client reported | P |
| `sf_children_risk` | Specific precautions around children — shown when `hh_children` equals “yes” | Paragraph | Client reported | P |
| `sf_referral` | Referral considerations<br><small>Veterinary exam · Veterinary behaviorist · Pain workup · Rescue organization involved · None at this time</small> | Multiple choice | Client reported | P |
| `sf_referral_note` | Referral notes — shown when `sf_referral` answered | Paragraph | Client reported | P |

## Learning & skills

What the dog already knows and what motivates them.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `sk_cues` | Known cues and how reliable they are | List | Either (per answer) |  |
| `sk_reinforcers` | Favorite reinforcers<br><small>Soft treats · Cheese / meat · Kibble · Toys — tug · Toys — fetch · Praise · Sniffing · Access to people · Access to dogs</small> | Multiple choice | Either (per answer) |  |
| `sk_food_motivation` | Food interest during training<br><small>Takes food readily everywhere · Takes food at home only · Picky / variable · Stops taking food when stressed</small> | Single choice | Either (per answer) |  |
| `sk_handling` | Handling tolerance | Paragraph | Either (per answer) |  |
| `sk_confidence` | Confidence in new environments | Paragraph | Either (per answer) |  |
| `sk_distractions` | Response to distractions | Paragraph | Either (per answer) |  |
| `sk_progress` | Progress on previous training | Paragraph | Client reported | *Follow-up* |

## Consultant observations

What Haley saw directly, kept separate from what was reported.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `ob_observed` | Directly observed behavior | Paragraph | Observed | R |
| `ob_reported_summary` | Owner-reported behavior (summary) | Paragraph | Client reported |  |
| `ob_environment` | Environmental influences noticed | Paragraph | Observed |  |
| `ob_stress` | Stress signals observed<br><small>Lip licking · Yawning · Panting (not heat related) · Pacing · Scanning · Shake-offs · Sniffing displacement · Avoidance · Freezing · Vocalizing · None observed</small> | Multiple choice | Observed |  |
| `ob_hypotheses` | Working hypotheses | Paragraph | Observed | P |
| `ob_further` | Areas needing further assessment | Paragraph | Observed |  |
| `ob_handler` | Handler skills and relationship notes | Paragraph | Observed | P |

## Recommendations

What happens next: management, goals, and homework.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `rc_management` | Immediate management recommendations | Paragraph | Observed | R |
| `rc_goals` | Prioritized goals | List | Observed | R |
| `rc_exercises` | Suggested exercises | List | Observed |  |
| `rc_homework` | Client homework | Paragraph | Observed |  |
| `rc_followup` | Follow-up needs<br><small>Follow-up session in 1 week · Follow-up session in 2 weeks · Email check-in · As needed · Referral first</small> | Single choice | Observed |  |
| `rc_success` | Observable success criteria | List | Observed |  |

## Module: Reactivity

Suggested when concerns include: Reactivity.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `re_targets` | Reactive toward<br><small>Dogs on leash · Dogs off leash · People · Bikes / scooters · Vehicles · Animals (squirrels, cats)</small> | Multiple choice | Either (per answer) |  |
| `re_leash_only` | Does it happen only on leash?<br><small>Only on leash · On and off leash · Unsure</small> | Single choice | Client reported |  |
| `re_threshold` | Where does the dog cope well? (distance, setting) | Paragraph | Either (per answer) |  |
| `re_routes` | Typical walking routes and problem spots | Paragraph | Client reported |  |
| `re_hallway` | Building/hallway encounters — shown when `hh_home_type` includes “Apartment” | Paragraph | Client reported |  |
| `re_redirect` | Has the dog redirected onto the leash or handler? | Yes / No / Unsure | Client reported | P |
| `re_redirect_detail` | Redirection details — shown when `re_redirect` equals “yes” | Paragraph | Client reported | P |

## Module: Aggression

Suggested when concerns include: Aggression, Multi-dog household conflict.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `ag_context` | Contexts where aggressive behavior has occurred<br><small>Resting places · Food / chews · Handling · Visitors entering · On walks · Toward other dogs at home · When startled · When restrained</small> | Multiple choice | Client reported | P |
| `ag_warning` | Warning signals the dog gives before escalating | Paragraph | Either (per answer) | P |
| `ag_warning_suppressed` | Have warnings ever been punished? | Yes / No / Unsure | Client reported | P |
| `ag_inhibition` | Description of bite inhibition (as reported) | Paragraph | Client reported | P |
| `ag_multi_dog` | Conflict between dogs in the home — shown when `co_main_concerns` includes “Multi-dog household conflict” | Paragraph | Client reported | P |
| `ag_muzzle` | Muzzle conditioning status<br><small>Comfortable wearing · In progress · Not started · Not recommended at this time</small> | Single choice | Client reported |  |

## Module: Fear & anxiety

Suggested when concerns include: Fear or anxiety, Rescue transition / decompression.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `fe_fears` | Things the dog is afraid of | List | Either (per answer) |  |
| `fe_coping` | Coping strategy when afraid<br><small>Flee / hide · Freeze · Fidget / appease · Fight / bark · Shut down</small> | Multiple choice | Either (per answer) |  |
| `fe_safe_spaces` | Safe spaces and comfort strategies | Paragraph | Client reported |  |
| `fe_noise` | Noise sensitivity (fireworks, construction, sirens) | Paragraph | Client reported |  |
| `fe_decompression` | Decompression since arrival — shown when `co_main_concerns` includes “Rescue transition / decompression” | Paragraph | Client reported |  |
| `fe_generalized` | Is the dog anxious much of the day, or in specific situations?<br><small>Specific situations · Much of the day · Unsure</small> | Single choice | Client reported |  |

## Module: Separation-related

Suggested when concerns include: Separation-related behavior.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `se_signs` | Behavior when alone<br><small>Vocalizing · Destruction near exits · House soiling · Pacing · Drooling / panting · Not eating · Escape attempts · Self-injury</small> | Multiple choice | Either (per answer) |  |
| `se_video` | Has the dog been recorded while alone? | Yes / No / Unsure | Client reported |  |
| `se_video_notes` | What the video shows, minute by minute — shown when `se_video` equals “yes” | Paragraph | Observed |  |
| `se_onset_time` | How soon after departure does it start? | Short text | Either (per answer) |  |
| `se_predeparture` | Responses to pre-departure cues (keys, shoes, coat) | Paragraph | Client reported |  |
| `se_tolerance` | Current comfortable alone time | Short text | Either (per answer) |  |
| `se_any_person` | Is the dog fine with any person present?<br><small>Yes, anyone · Only specific people · Unsure</small> | Single choice | Client reported |  |
| `se_coverage` | Absence-management options available<br><small>Dog sitter · Daycare · Work from home days · Friends / family · Bring dog along · None yet</small> | Multiple choice | Client reported |  |

## Module: Resource guarding

Suggested when concerns include: Resource guarding.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `rg_items` | Items or places guarded<br><small>Food bowl · High-value chews · Stolen items · Toys · Resting places / furniture · People · Crate · Spaces / doorways</small> | Multiple choice | Either (per answer) |  |
| `rg_from` | Guarded from<br><small>Adults · Children · Other dogs · Other pets · Visitors</small> | Multiple choice | Client reported |  |
| `rg_signs` | Guarding signals<br><small>Stiffening · Eating faster · Hard eye · Growling · Lip lift · Air snap · Bite</small> | Multiple choice | Either (per answer) | P |
| `rg_trades` | Does the dog trade items willingly?<br><small>Yes, for most items · Only low-value items · No · Not tried</small> | Single choice | Client reported |  |
| `rg_management` | Current management around resources | Paragraph | Client reported |  |

## Module: Cooperative care

Suggested when concerns include: Handling / cooperative care.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `cc_procedures` | Procedures that are difficult<br><small>Nail trims · Ear cleaning · Eye drops · Tooth brushing · Brushing / grooming · Bathing · Vet exam · Injections · Muzzle wear · Harness on/off</small> | Multiple choice | Either (per answer) |  |
| `cc_vet_visits` | How vet visits currently go | Paragraph | Client reported |  |
| `cc_sedation` | Has sedation or pre-visit medication been used? | Yes / No / Unsure | Client reported |  |
| `cc_consent` | Start-button or consent behaviors already taught | Short text | Either (per answer) |  |

## Module: Puppy development

Suggested when concerns include: Puppy development, House training, Jumping / mouthing.

| ID | Question | Type | Source | Flags |
|---|---|---|---|---|
| `pp_age_weeks` | Age in weeks | Number | Client reported |  |
| `pp_vaccines` | Vaccination status and outdoor access | Short text | Client reported |  |
| `pp_socialization` | Socialization experiences so far | List | Client reported |  |
| `pp_house_training` | House training progress | Paragraph | Client reported |  |
| `pp_mouthing` | Mouthing and play biting | Paragraph | Client reported |  |
| `pp_sleep_crate` | Crate and sleep routine | Paragraph | Client reported |  |
| `pp_alone_practice` | Short alone-time practice | Short text | Client reported |  |
