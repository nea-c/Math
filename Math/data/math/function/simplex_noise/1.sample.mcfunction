data modify storage math: internal.noise.simplex.x set compute default float math:simplex_noise/x
data modify storage math: internal.noise.simplex.y set compute default float math:simplex_noise/y
data modify storage math: internal.noise.simplex.z set compute default float math:simplex_noise/z
data modify storage math: internal.noise.simplex.skew set compute default float math:simplex_noise/skew
data modify storage math: internal.noise.simplex.ix set compute default float math:simplex_noise/ix
data modify storage math: internal.noise.simplex.iy set compute default float math:simplex_noise/iy
data modify storage math: internal.noise.simplex.iz set compute default float math:simplex_noise/iz
data modify storage math: internal.noise.simplex.unskew set compute default float math:simplex_noise/unskew
data modify storage math: internal.noise.simplex.x0 set compute default float math:simplex_noise/x0
data modify storage math: internal.noise.simplex.y0 set compute default float math:simplex_noise/y0
data modify storage math: internal.noise.simplex.z0 set compute default float math:simplex_noise/z0
data modify storage math: internal.noise.simplex.i1 set value 1.0f
data modify storage math: internal.noise.simplex.j1 set value 0.0f
data modify storage math: internal.noise.simplex.k1 set value 0.0f
data modify storage math: internal.noise.simplex.i2 set value 1.0f
data modify storage math: internal.noise.simplex.j2 set value 1.0f
data modify storage math: internal.noise.simplex.k2 set value 0.0f
execute if predicate math:simplex_noise/x0_ge_y0 if predicate math:simplex_noise/y0_ge_z0 run function math:simplex_noise/case/xyz
execute if predicate math:simplex_noise/x0_ge_z0 if predicate math:simplex_noise/z0_ge_y0 run function math:simplex_noise/case/xzy
execute if predicate math:simplex_noise/z0_ge_x0 if predicate math:simplex_noise/x0_ge_y0 run function math:simplex_noise/case/zxy
execute if predicate math:simplex_noise/z0_ge_y0 if predicate math:simplex_noise/y0_ge_x0 run function math:simplex_noise/case/zyx
execute if predicate math:simplex_noise/y0_ge_z0 if predicate math:simplex_noise/z0_ge_x0 run function math:simplex_noise/case/yzx
execute if predicate math:simplex_noise/y0_ge_x0 if predicate math:simplex_noise/x0_ge_z0 run function math:simplex_noise/case/yxz
data modify storage math: internal.noise.simplex_work.ox set value 0.0f
data modify storage math: internal.noise.simplex_work.oy set value 0.0f
data modify storage math: internal.noise.simplex_work.oz set value 0.0f
data modify storage math: internal.noise.simplex_work.unskew set value 0.0f
function math:simplex_noise/2.corner
data modify storage math: internal.noise.simplex.c0 set from storage math: internal.noise.simplex_work.contribution
data modify storage math: internal.noise.simplex_work.ox set from storage math: internal.noise.simplex.i1
data modify storage math: internal.noise.simplex_work.oy set from storage math: internal.noise.simplex.j1
data modify storage math: internal.noise.simplex_work.oz set from storage math: internal.noise.simplex.k1
data modify storage math: internal.noise.simplex_work.unskew set value 0.16666666666666666f
function math:simplex_noise/2.corner
data modify storage math: internal.noise.simplex.c1 set from storage math: internal.noise.simplex_work.contribution
data modify storage math: internal.noise.simplex_work.ox set from storage math: internal.noise.simplex.i2
data modify storage math: internal.noise.simplex_work.oy set from storage math: internal.noise.simplex.j2
data modify storage math: internal.noise.simplex_work.oz set from storage math: internal.noise.simplex.k2
data modify storage math: internal.noise.simplex_work.unskew set value 0.3333333333333333f
function math:simplex_noise/2.corner
data modify storage math: internal.noise.simplex.c2 set from storage math: internal.noise.simplex_work.contribution
data modify storage math: internal.noise.simplex_work.ox set value 1.0f
data modify storage math: internal.noise.simplex_work.oy set value 1.0f
data modify storage math: internal.noise.simplex_work.oz set value 1.0f
data modify storage math: internal.noise.simplex_work.unskew set value 0.5f
function math:simplex_noise/2.corner
data modify storage math: internal.noise.simplex.c3 set from storage math: internal.noise.simplex_work.contribution
data modify storage math: internal.noise.simplex_output set compute default float math:simplex_noise/result
