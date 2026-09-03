data modify storage math: internal.noise.sample_work.lx set compute default float math:.common/noise/sample/corner_ix
data modify storage math: internal.noise.sample_work.ly set compute default float math:.common/noise/sample/corner_iy
data modify storage math: internal.noise.sample_work.lz set compute default float math:.common/noise/sample/corner_iz
data modify storage math: internal.noise.sample_work.gx set compute default float math:.common/noise/sample/corner_dx
data modify storage math: internal.noise.sample_work.gy set compute default float math:.common/noise/sample/corner_dy
data modify storage math: internal.noise.sample_work.gz set compute default float math:.common/noise/sample/corner_dz
data modify storage math: internal.noise.work.ix set from storage math: internal.noise.sample_work.lx
data modify storage math: internal.noise.work.iy set from storage math: internal.noise.sample_work.ly
data modify storage math: internal.noise.work.iz set from storage math: internal.noise.sample_work.lz
data modify storage math: internal.noise.work.seed set from storage math: internal.noise.sample_input.seed
data modify storage math: internal.noise.work.salt set value 0.0f
function math:.common/noise/hash
data modify storage math: internal.noise.sample_work.corner set compute default float math:.common/noise/sample/gradient
