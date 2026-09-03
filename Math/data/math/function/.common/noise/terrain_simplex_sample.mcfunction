data modify storage math: internal.noise.simplex_input.x set compute default float math:.common/noise/terrain/scaled_x
data modify storage math: internal.noise.simplex_input.y set compute default float math:.common/noise/terrain/scaled_y
data modify storage math: internal.noise.simplex_input.z set compute default float math:.common/noise/terrain/scaled_z
data modify storage math: internal.noise.simplex_input.seed set compute default float math:.common/noise/terrain/seed
function math:simplex_noise/1.sample
