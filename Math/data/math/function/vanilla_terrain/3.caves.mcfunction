data modify storage math: internal.noise.terrain.scale_x set value 0.015f
data modify storage math: internal.noise.terrain.scale_y set value 0.012f
data modify storage math: internal.noise.terrain.scale_z set value 0.015f
data modify storage math: internal.noise.terrain.seed_offset set value 16000.0f
function math:.common/noise/terrain_simplex_sample
data modify storage math: internal.noise.terrain.cave_a set from storage math: internal.noise.simplex_output
data modify storage math: internal.noise.terrain.scale_x set value 0.0266666667f
data modify storage math: internal.noise.terrain.scale_y set value 0.035f
data modify storage math: internal.noise.terrain.scale_z set value 0.0266666667f
data modify storage math: internal.noise.terrain.seed_offset set value 17000.0f
function math:.common/noise/terrain_simplex_sample
data modify storage math: internal.noise.terrain.cave_b set from storage math: internal.noise.simplex_output
data modify storage math: internal.noise.terrain.entrance_noise set compute default float math:.common/noise/terrain/entrance_noise_approx
data modify storage math: internal.noise.terrain.cave_layer set compute default float math:.common/noise/terrain/cave_layer_approx
data modify storage math: internal.noise.terrain.cave_cheese set compute default float math:.common/noise/terrain/cave_cheese_approx
data modify storage math: internal.noise.terrain.spaghetti_noise set compute default float math:.common/noise/terrain/spaghetti_noise_approx
data modify storage math: internal.noise.terrain.noodle_noise set compute default float math:.common/noise/terrain/noodle_noise_approx
data modify storage math: internal.noise.terrain.entrance_y set compute default float math:.common/noise/terrain/entrance_y
data modify storage math: internal.noise.terrain.entrance set compute default float math:.common/noise/terrain/entrance
data modify storage math: internal.noise.terrain.cave_layer_term set compute default float math:.common/noise/terrain/cave_layer_term
data modify storage math: internal.noise.terrain.cave_cheese_term set compute default float math:.common/noise/terrain/cave_cheese_term
data modify storage math: internal.noise.terrain.cave_surface_term set compute default float math:.common/noise/terrain/cave_surface_term
data modify storage math: internal.noise.terrain.cave_shape set compute default float math:.common/noise/terrain/cave_shape
data modify storage math: internal.noise.terrain.spaghetti set compute default float math:.common/noise/terrain/spaghetti
data modify storage math: internal.noise.terrain.cave_main set compute default float math:.common/noise/terrain/cave_main
data modify storage math: internal.noise.terrain.cave_low set compute default float math:.common/noise/terrain/cave_low
data modify storage math: internal.noise.terrain.cave_branch_alpha set compute default float math:.common/noise/terrain/cave_branch_alpha
data modify storage math: internal.noise.terrain.cave_combined set compute default float math:.common/noise/terrain/cave_combined
data modify storage math: internal.noise.terrain.noodle set compute default float math:.common/noise/terrain/noodle
