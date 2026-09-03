data remove storage math: internal.noise
data modify storage math: internal.noise.sample_input.x set compute default float math:.common/noise/input_x
data modify storage math: internal.noise.sample_input.y set compute default float math:.common/noise/input_y
data modify storage math: internal.noise.sample_input.z set compute default float math:.common/noise/input_z
data modify storage math: internal.noise.sample_input.seed set from storage math: seed
function math:.common/noise/sample
data modify storage math: internal.noise.work.value set from storage math: internal.noise.sample_output
data modify storage math: ans set compute default float math:.common/noise/remap
data remove storage math: internal.noise
