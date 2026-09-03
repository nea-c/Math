data modify storage math: internal.noise.work.ix set compute default float math:simplex_noise/corner_ix
data modify storage math: internal.noise.work.iy set compute default float math:simplex_noise/corner_iy
data modify storage math: internal.noise.work.iz set compute default float math:simplex_noise/corner_iz
data modify storage math: internal.noise.work.seed set from storage math: internal.noise.simplex_input.seed
data modify storage math: internal.noise.work.salt set value 37.0f
function math:.common/noise/hash
data modify storage math: internal.noise.simplex_work.dx set compute default float math:simplex_noise/corner_dx
data modify storage math: internal.noise.simplex_work.dy set compute default float math:simplex_noise/corner_dy
data modify storage math: internal.noise.simplex_work.dz set compute default float math:simplex_noise/corner_dz
data modify storage math: internal.noise.gradient.dx set from storage math: internal.noise.simplex_work.dx
data modify storage math: internal.noise.gradient.dy set from storage math: internal.noise.simplex_work.dy
data modify storage math: internal.noise.gradient.dz set from storage math: internal.noise.simplex_work.dz
data modify storage math: internal.noise.simplex_work.dot set compute default float math:.common/noise/gradient_dot
data modify storage math: internal.noise.simplex_work.atten set compute default float math:simplex_noise/atten
data modify storage math: internal.noise.simplex_work.contribution set compute default float math:simplex_noise/contribution
