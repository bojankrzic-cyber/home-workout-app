# Coach voice re-record: progress

Voice: Magnific `audio_tts`, `model: "eleven_v3"`, `voiceId: 270` (Henry Arthur), `stability: 0.5`, no delivery tags, phrases joined by ` [pause 1s] `.
Status: **NOT swapped**. audio/voice still holds the old clips. audio/voice_new is the staging dir.

2026-10-19: the first call was refused with "Today's free limit for voiceover-generator (mode: eleven_v3) is used up" (0 credits charged). simulate_cost reported isFree:true, but it does not see the daily cap. The limit resets at 00:00 UTC.

2026-10-20: refused again at 00:16 UTC with the same daily-limit message on the first call (0 credits). The free eleven_v3 voiceover allowance appears to be 0 on this account; nothing recorded.

## Resume
```
python3 tools/voice/make_lists.py          # idempotent: rebuilds/extends the 4 lists
python3 tools/voice/make_takes.py <scratch>/takes audio/voice_new   # packs only missing keys into <=480-char takes
# per take: simulate_cost (must be credits 0) -> audio_tts(text=<take>.txt, model eleven_v3, voiceId 270, stability 0.5)
#           -> creations_wait -> creations_get url -> curl -o take.mp3
python3 tools/voice/split.py take.mp3 <take>.json audio/voice_new   # re-record if any clip < 0.6
# when audio/voice_new has every key of all 4 lists: rm -r audio/voice && mv audio/voice_new audio/voice && python3 tools/voice/build_manifest.py
```

## clips_names.json: 0/119 done

Done: none

Missing: rest_15, rest_20, rest_30, rest_45, rest_60, rest_75, rest_90, rest_105, rest_120, rest_150, rest_180, next, set_2, set_3, set_4, set_5, set_6, m_50, m_100, m_200, m_250, m_500, m_1000, hard, easy, half, done, go, hello, ex_bike_z2, ex_bike_hiit, ex_row_steady, ex_row_hiit, ex_kb_swing, ex_kb_goblet_squat, ex_kb_deadlift, ex_kb_press, ex_db_bench, ex_db_incline, ex_db_row, ex_db_rdl, ex_db_bulgarian, ex_db_shoulder_press, ex_db_curl, ex_db_hip_thrust, ex_db_stepup, ex_k_chest_press, ex_k_row, ex_k_pulldown, ex_k_face_pull, ex_k_pushdown, ex_k_pullthrough, ex_k_woodchop, ex_pullup, ex_hang_knee_raise, ex_hang_leg_raise, ex_dead_hang, ex_back_ext, ex_situp, ex_pushup, ex_plank, ex_dead_bug, ex_bird_dog, ex_hip_flexor, ex_hamstring_bench, ex_hx_bike_run, ex_k_ski, ex_bike_sled, ex_k_sled_pull, ex_burpee_bj, ex_kb_farmers, ex_kb_lunge, ex_db_thruster, ex_treadmill_run, ex_skierg, ex_sled_push, ex_sled_pull, ex_wall_ball, ex_sandbag_lunge, ex_bb_squat, ex_bb_deadlift, ex_bb_bench, ex_box_jump, ex_jump_rope, ex_band_row, ex_band_pushdown, ex_db_farmers, ex_bw_squat, ex_bw_lunge, ex_glute_bridge, ex_mountain_climber, ex_high_knees, ex_susp_row, ex_susp_pushup, ex_susp_squat, ex_susp_fallout, ex_abwheel_rollout, ex_ball_slam, ex_ball_rot_slam, ex_rope_waves, ex_roll_tspine, ex_roll_quads, ex_dips, ex_lsit, ex_landmine_press, ex_landmine_row, ex_airbike_sprint, ex_airbike_z2, ex_knee_pushup, ex_pike_pushup, ex_superman, ex_prone_y_raise, ex_side_plank, ex_wall_sit, ex_jump_squat, ex_burpee, ex_hollow_hold, ex_sl_glute_bridge, ex_hamstring_floor

## clips_cues.json: 0/90 done

Done: none

Missing: cue_bike_z2, cue_bike_hiit, cue_row_steady, cue_row_hiit, cue_kb_swing, cue_kb_goblet_squat, cue_kb_deadlift, cue_kb_press, cue_db_bench, cue_db_incline, cue_db_row, cue_db_rdl, cue_db_bulgarian, cue_db_shoulder_press, cue_db_curl, cue_db_hip_thrust, cue_db_stepup, cue_k_chest_press, cue_k_row, cue_k_pulldown, cue_k_face_pull, cue_k_pushdown, cue_k_pullthrough, cue_k_woodchop, cue_pullup, cue_hang_knee_raise, cue_hang_leg_raise, cue_dead_hang, cue_back_ext, cue_situp, cue_pushup, cue_plank, cue_dead_bug, cue_bird_dog, cue_hip_flexor, cue_hamstring_bench, cue_hx_bike_run, cue_k_ski, cue_bike_sled, cue_k_sled_pull, cue_burpee_bj, cue_kb_farmers, cue_kb_lunge, cue_db_thruster, cue_treadmill_run, cue_skierg, cue_sled_push, cue_sled_pull, cue_wall_ball, cue_sandbag_lunge, cue_bb_squat, cue_bb_deadlift, cue_bb_bench, cue_box_jump, cue_jump_rope, cue_band_row, cue_band_pushdown, cue_db_farmers, cue_bw_squat, cue_bw_lunge, cue_glute_bridge, cue_mountain_climber, cue_high_knees, cue_knee_pushup, cue_pike_pushup, cue_superman, cue_prone_y_raise, cue_side_plank, cue_wall_sit, cue_jump_squat, cue_burpee, cue_hollow_hold, cue_sl_glute_bridge, cue_hamstring_floor, cue_susp_row, cue_susp_pushup, cue_susp_squat, cue_susp_fallout, cue_abwheel_rollout, cue_ball_slam, cue_ball_rot_slam, cue_rope_waves, cue_roll_tspine, cue_roll_quads, cue_dips, cue_lsit, cue_landmine_press, cue_landmine_row, cue_airbike_sprint, cue_airbike_z2

## clips_motivation.json: 0/19 done

Done: none

Missing: hype_two_more_finish_strong, hype_two_left_stay_tight, hype_push_two_more, hype_nailed_it, hype_great_set, hype_strong_set, hype_that_s_how_it_s_done, hype_beautiful_reps, hype_crushed_it, hype_10_seconds_push, hype_ten_to_go_dig_deep, hype_finish_strong_10_seconds, hype_last_set_make_it_count, hype_final_set_leave_nothing_behind, hype_one_more_set_finish_strong, hype_final_exercise_finish_strong, hype_almost_there_empty_the_tank, hype_new_personal_best, hype_last_one_of_the_day_bring_it_home

## clips_trail.json: 0/126 done

Done: none

Missing: n_1, n_2, n_3, n_4, n_5, n_6, n_7, n_8, n_9, n_10, n_11, n_12, n_13, n_14, n_15, n_16, n_17, n_18, n_19, n_20, n_21, n_22, n_23, n_24, n_25, n_26, n_27, n_28, n_29, n_30, n_31, n_32, n_33, n_34, n_35, n_36, n_37, n_38, n_39, n_40, n_41, n_42, n_43, n_44, n_45, n_46, n_47, n_48, n_49, n_50, n_51, n_52, n_53, n_54, n_55, n_56, n_57, n_58, n_59, n_60, n_61, n_62, n_63, n_64, n_65, n_66, n_67, n_68, n_69, n_70, n_71, n_72, n_73, n_74, n_75, n_76, n_77, n_78, n_79, n_80, n_81, n_82, n_83, n_84, n_85, n_86, n_87, n_88, n_89, n_90, n_91, n_92, n_93, n_94, n_95, n_96, n_97, n_98, n_99, oh_1, oh_2, oh_3, oh_4, oh_5, oh_6, oh_7, oh_8, oh_9, minutes_flat, km_one, km_many, pace, speed, per_km, kmh, point, trail_run, trail_walk, trail_hike, trail_ride, paused, resumed, lap, trail_done, hr_connected, coach_on
