data remove storage math: ans
data modify storage math: internal.noise.base_x set compute default float math:.common/noise/input_x
data modify storage math: internal.noise.base_y set compute default float math:.common/noise/input_y
data modify storage math: internal.noise.base_z set compute default float math:.common/noise/input_z
data modify storage math: internal.noise.base_seed set from storage math: seed
data modify storage math: internal.noise.sum set value 0.0f
data modify storage math: internal.noise.amplitude_sum set value 1.875f
data modify storage math: internal.noise.sample_input.x set compute default float math:fbm/0_x
data modify storage math: internal.noise.sample_input.y set compute default float math:fbm/0_y
data modify storage math: internal.noise.sample_input.z set compute default float math:fbm/0_z
data modify storage math: internal.noise.sample_input.seed set compute default float math:fbm/0_seed
function math:.common/noise/sample
data modify storage math: internal.noise.amplitude set value 1.0f
data modify storage math: internal.noise.sum set compute default float math:.common/noise/accumulate
data modify storage math: internal.noise.sample_input.x set compute default float math:fbm/1_x
data modify storage math: internal.noise.sample_input.y set compute default float math:fbm/1_y
data modify storage math: internal.noise.sample_input.z set compute default float math:fbm/1_z
data modify storage math: internal.noise.sample_input.seed set compute default float math:fbm/1_seed
function math:.common/noise/sample
data modify storage math: internal.noise.amplitude set value 0.5f
data modify storage math: internal.noise.sum set compute default float math:.common/noise/accumulate
data modify storage math: internal.noise.sample_input.x set compute default float math:fbm/2_x
data modify storage math: internal.noise.sample_input.y set compute default float math:fbm/2_y
data modify storage math: internal.noise.sample_input.z set compute default float math:fbm/2_z
data modify storage math: internal.noise.sample_input.seed set compute default float math:fbm/2_seed
function math:.common/noise/sample
data modify storage math: internal.noise.amplitude set value 0.25f
data modify storage math: internal.noise.sum set compute default float math:.common/noise/accumulate
data modify storage math: internal.noise.sample_input.x set compute default float math:fbm/3_x
data modify storage math: internal.noise.sample_input.y set compute default float math:fbm/3_y
data modify storage math: internal.noise.sample_input.z set compute default float math:fbm/3_z
data modify storage math: internal.noise.sample_input.seed set compute default float math:fbm/3_seed
function math:.common/noise/sample
data modify storage math: internal.noise.amplitude set value 0.125f
data modify storage math: internal.noise.sum set compute default float math:.common/noise/accumulate
data modify storage math: internal.noise.work.value set compute default float math:.common/noise/normalize
data modify storage math: ans set compute default float math:.common/noise/remap
data remove storage math: internal
