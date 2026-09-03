data modify storage math: internal.noise.simplex2d.x set compute default float math:.common/noise/simplex2d/x
data modify storage math: internal.noise.simplex2d.z set compute default float math:.common/noise/simplex2d/z
data modify storage math: internal.noise.simplex2d.skew set compute default float math:.common/noise/simplex2d/skew
data modify storage math: internal.noise.simplex2d.i set compute default float math:.common/noise/simplex2d/i
data modify storage math: internal.noise.simplex2d.j set compute default float math:.common/noise/simplex2d/j
data modify storage math: internal.noise.simplex2d.unskew set compute default float math:.common/noise/simplex2d/unskew
data modify storage math: internal.noise.simplex2d.x0 set compute default float math:.common/noise/simplex2d/x0
data modify storage math: internal.noise.simplex2d.z0 set compute default float math:.common/noise/simplex2d/z0
data modify storage math: internal.noise.simplex2d.i1 set value 1.0f
data modify storage math: internal.noise.simplex2d.j1 set value 0.0f
execute unless predicate math:.common/noise/simplex2d/x0_ge_z0 run function math:.common/noise/simplex2d/case/z_first
data modify storage math: internal.noise.simplex2d_work.oi set value 0.0f
data modify storage math: internal.noise.simplex2d_work.oj set value 0.0f
data modify storage math: internal.noise.simplex2d_work.unskew set value 0.0f
function math:.common/noise/simplex2d/corner
data modify storage math: internal.noise.simplex2d.c0 set from storage math: internal.noise.simplex2d_work.contribution
data modify storage math: internal.noise.simplex2d_work.oi set from storage math: internal.noise.simplex2d.i1
data modify storage math: internal.noise.simplex2d_work.oj set from storage math: internal.noise.simplex2d.j1
data modify storage math: internal.noise.simplex2d_work.unskew set value 0.21132486540518713f
function math:.common/noise/simplex2d/corner
data modify storage math: internal.noise.simplex2d.c1 set from storage math: internal.noise.simplex2d_work.contribution
data modify storage math: internal.noise.simplex2d_work.oi set value 1.0f
data modify storage math: internal.noise.simplex2d_work.oj set value 1.0f
data modify storage math: internal.noise.simplex2d_work.unskew set value 0.42264973081037427f
function math:.common/noise/simplex2d/corner
data modify storage math: internal.noise.simplex2d.c2 set from storage math: internal.noise.simplex2d_work.contribution
data modify storage math: internal.noise.simplex2d_output set compute default float math:.common/noise/simplex2d/result
