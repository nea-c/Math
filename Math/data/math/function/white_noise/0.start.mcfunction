data remove storage math: internal.noise
data modify storage math: internal.noise.white.x set compute default float math:.common/noise/input_x
data modify storage math: internal.noise.white.y set compute default float math:.common/noise/input_y
data modify storage math: internal.noise.white.z set compute default float math:.common/noise/input_z
data modify storage math: internal.noise.work.ix set compute default float math:white_noise/x
data modify storage math: internal.noise.work.iy set compute default float math:white_noise/y
data modify storage math: internal.noise.work.iz set compute default float math:white_noise/z
data modify storage math: internal.noise.work.seed set from storage math: seed
data modify storage math: internal.noise.work.salt set value 0.0f
function math:.common/noise/hash
data modify storage math: internal.noise.work.value set from storage math: internal.noise.hash.result
data modify storage math: ans set compute default float math:.common/noise/remap
data remove storage math: internal.noise
