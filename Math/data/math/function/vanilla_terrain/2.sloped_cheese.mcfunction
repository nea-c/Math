data modify storage math: internal.noise.terrain.jagged_noise set compute default float math:.common/noise/terrain/jagged_noise_approx
data modify storage math: internal.noise.terrain.scale_x set value 0.01f
data modify storage math: internal.noise.terrain.scale_y set value 0.005f
data modify storage math: internal.noise.terrain.scale_z set value 0.01f
data modify storage math: internal.noise.terrain.seed_offset set value 15000.0f
function math:.common/noise/terrain_simplex_sample
data modify storage math: internal.noise.terrain.base3d set from storage math: internal.noise.simplex_output
data modify storage math: internal.noise.terrain.jagged_half_negative set compute default float math:.common/noise/terrain/jagged_half_negative
data modify storage math: internal.noise.terrain.sloped_raw set compute default float math:.common/noise/terrain/sloped_raw
data modify storage math: internal.noise.terrain.sloped_quarter_negative set compute default float math:.common/noise/terrain/sloped_quarter_negative
data modify storage math: internal.noise.terrain.sloped_cheese set compute default float math:.common/noise/terrain/sloped_cheese
