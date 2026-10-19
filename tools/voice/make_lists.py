"""Build/extend the clip lists (clips_names/cues/motivation/trail.json) for the recorded coach voice.

usage: python3 tools/voice/make_lists.py   (idempotent; keeps every existing key and its text)
"""
import json, os, subprocess

D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(D))

def load(n): return json.load(open(f'{D}/clips_{n}.json'))
def save(n, lst): json.dump(lst, open(f'{D}/clips_{n}.json', 'w'), indent=1, ensure_ascii=False)

ex = json.loads(subprocess.run(['node', '-e', "global.window=global;require('./js/figure.js');require('./js/exercises.js');"
    "console.log(JSON.stringify(window.Exercises.LIST.map(e=>[e.id,e.name,(e.cues||[])[0]])))"], cwd=ROOT, capture_output=True, text=True, check=True).stdout)

NAMES = {
 'knee_pushup': 'Knee push-up.', 'pike_pushup': 'Pike push-up.', 'superman': 'Superman.', 'prone_y_raise': 'Prone Y raise.',
 'side_plank': 'Side plank.', 'wall_sit': 'Wall sit.', 'jump_squat': 'Jump squat.', 'burpee': 'Burpee.', 'hollow_hold': 'Hollow hold.',
 'sl_glute_bridge': 'Single-leg glute bridge.', 'hamstring_floor': 'Seated hamstring stretch.',
}
CUES = {
 'kb_deadlift': 'Kettlebell between the feet, feet slightly wider than hips.',
 'db_shoulder_press': 'Backrest near upright, back against the pad.',
 'k_chest_press': 'Back to the machine, split stance.',
 'k_row': 'Facing the machine, soft knees.',
 'k_pulldown': 'Half-kneeling, glutes squeezed, torso upright.',
 'k_face_pull': 'Handles at face height.',
 'k_pushdown': 'Elbows pinned to your sides.',
 'k_pullthrough': 'Back to the machine, cable between the legs.',
 'k_woodchop': 'Side-on to the machine, arms extended.',
 'pullup': 'Start from a dead hang, set the shoulder blades first.',
 'hang_knee_raise': 'Active hang. Shoulders away from the ears.',
 'hang_leg_raise': 'Legs straight, toes pointed.',
 'dead_hang': 'Relax into the hang. Decompress the spine.',
 'back_ext': 'Pad just below the hip bones.',
 'situp': 'Feet hooked under the rollers.',
 'pushup': 'Hands under shoulders, body in a straight plank.',
 'plank': 'Elbows under shoulders.',
 'dead_bug': 'Lower back pressed into the floor the whole time.',
 'bird_dog': 'On all fours, back flat as a table.',
 'bike_sled': 'Resistance high enough to drop your cadence below sixty-five.',
 'k_sled_pull': 'Low pulley in front, athletic stance, hips back.',
 'kb_farmers': 'Two kettlebells at your sides, shoulders down and back.',
 'kb_lunge': 'Kettlebell held at the chest, goblet style.',
 'treadmill_run': 'Tall posture, slight lean from the ankles.',
 'skierg': 'Handles overhead, arms slightly bent.',
 'sled_push': 'Arms extended on the high handles, body at about forty-five degrees.',
 'sled_pull': 'Athletic stance, hips back, weight in the heels.',
 'wall_ball': 'Ball under the chin, elbows under the ball.',
 'sandbag_lunge': 'Sandbag across the shoulders, behind the neck.',
 'bb_squat': 'Bar on the upper traps, elbows under the bar.',
 'bb_deadlift': 'Bar over mid-foot, shins touching it.',
 'bb_bench': 'Shoulder blades together, feet planted.',
 'box_jump': 'Swing the arms and dip quickly.',
 'jump_rope': 'Low bounces off the balls of the feet, soft knees.',
 'band_row': 'Band anchored at chest height.',
 'band_pushdown': 'Band anchored high.',
 'db_farmers': 'Dumbbells at your sides, shoulders down and back.',
 'bw_squat': 'Feet shoulder-width, arms forward for balance.',
 'bw_lunge': 'Hands on hips, torso upright.',
 'glute_bridge': 'On your back, feet close to the glutes.',
 'mountain_climber': 'Hands under shoulders, hips in line.',
 'high_knees': 'Knees to hip height.',
 'knee_pushup': 'Knees down, hands just wider than the shoulders.',
 'pike_pushup': 'Hips high in an upside-down V, hands shoulder-width.',
 'superman': 'Lie face down, arms long in front of you.',
 'prone_y_raise': 'Lie face down, arms overhead in a Y, thumbs up.',
 'side_plank': 'Elbow under the shoulder, feet stacked.',
 'wall_sit': 'Back flat on the wall, feet a step out in front.',
 'jump_squat': 'Squat down with the arms swinging back.',
 'burpee': 'Squat and place the hands on the floor.',
 'hollow_hold': 'Lie on your back and press the lower back into the floor.',
 'sl_glute_bridge': 'One foot flat near the glutes, the other leg straight.',
 'hamstring_floor': 'Sit tall with the legs straight out in front, toes up.',
 'susp_row': 'Walk the feet forward to make it harder, back to make it easier.',
 'susp_pushup': 'Face away from the anchor, straps taut, arms straight at chest height.',
 'susp_squat': 'Face the anchor, hold the handles, light tension in the straps.',
 'susp_fallout': 'Face away from the anchor, arms straight, on the balls of the feet.',
 'abwheel_rollout': 'Knees on a pad, wheel under the shoulders, arms straight.',
 'ball_slam': 'Reach tall. Ball overhead, up on the toes.',
 'ball_rot_slam': 'Ball overhead, then rotate and slam it beside the outside of one foot.',
 'rope_waves': 'Athletic half squat. Hips back, chest up, core braced.',
 'roll_tspine': 'Roller across the upper back, hands support the head.',
 'roll_quads': 'Face down on the forearms, roller under the thighs.',
 'dips': 'Arms locked, shoulders down, away from the ears.',
 'lsit': 'Arms locked, push the bars down. Shoulders away from the ears.',
 'landmine_press': 'Staggered stance, bar end at the shoulder.',
 'landmine_row': 'Straddle the bar, grip under the plates.',
 'airbike_sprint': 'Push and pull the handles while you pedal. Arms and legs.',
 'airbike_z2': 'Even rhythm, arms and legs share the work.',
}

names = load('names'); have = {k for k, _ in names}
for i, n, c in ex:
    if 'ex_' + i not in have: names.append(['ex_' + i, NAMES[i]])
save('names', names)

cues = dict(load('cues')); out = []
for i, n, c in ex:
    k = 'cue_' + i
    out.append([k, cues.pop(k) if k in cues else CUES[i]])
out += [[k, v] for k, v in cues.items()]   # keep any legacy keys
save('cues', out)

mot = load('motivation')
if 'hype_last_one_of_the_day_bring_it_home' not in dict(mot):
    mot.append(['hype_last_one_of_the_day_bring_it_home', 'Last one of the day. Bring it home.'])
save('motivation', mot)

ONES = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split()
def word(n):
    if n < 20: return ONES[n - 1]
    t, o = divmod(n, 10)
    return TENS[t - 2] + ('-' + ONES[o - 1] if o else '')
trail = [[f'n_{n}', word(n)] for n in range(1, 100)]
trail += [[f'oh_{n}', 'oh ' + ONES[n - 1]] for n in range(1, 10)]
trail += [['minutes_flat', 'minutes flat'], ['km_one', 'kilometre'], ['km_many', 'kilometres'], ['pace', 'Pace'], ['speed', 'Speed'],
          ['per_km', 'per kilometre'], ['kmh', 'kilometres per hour'], ['point', 'point'],
          ['trail_run', 'Run started. Have a great one.'], ['trail_walk', 'Walk started. Enjoy it.'],
          ['trail_hike', 'Hike started. Enjoy the views.'], ['trail_ride', 'Ride started. Ride safe.'],
          ['paused', 'Paused.'], ['resumed', "Resumed. Let's go."], ['lap', 'Lap.'], ['trail_done', 'Great work. Your activity is saved.'],
          ['hr_connected', 'Heart rate connected.'], ['coach_on', 'Voice coaching is on.']]
save('trail', trail)
for n in ('names', 'cues', 'motivation', 'trail'): print(n, len(load(n)))
