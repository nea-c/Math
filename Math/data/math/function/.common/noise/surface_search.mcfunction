data modify storage math: internal.noise.surface.estimate set compute default float math:.common/noise/surface/estimate
data modify storage math: internal.noise.surface.local_lower set compute default float math:.common/noise/surface/local_lower
data modify storage math: internal.noise.surface.local_upper set compute default float math:.common/noise/surface/local_upper
data modify storage math: internal.noise.surface.y set from storage math: internal.noise.surface.estimate
function math:.common/noise/surface_density_sample
data modify storage math: internal.noise.surface.estimate_density set from storage math: internal.noise.surface.density
data modify storage math: internal.noise.surface.low set from storage math: internal.noise.surface.local_lower
data modify storage math: internal.noise.surface.high set from storage math: internal.noise.surface.estimate
execute if predicate math:.common/noise/surface/estimate_nonnegative run data modify storage math: internal.noise.surface.low set from storage math: internal.noise.surface.estimate
execute if predicate math:.common/noise/surface/estimate_nonnegative run data modify storage math: internal.noise.surface.high set from storage math: internal.noise.surface.local_upper
data modify storage math: internal.noise.surface.y set from storage math: internal.noise.surface.low
execute if predicate math:.common/noise/surface/estimate_nonnegative run data modify storage math: internal.noise.surface.y set from storage math: internal.noise.surface.high
function math:.common/noise/surface_density_sample
execute if predicate math:.common/noise/surface/estimate_nonnegative if predicate math:.common/noise/surface/density_nonnegative run data modify storage math: internal.noise.surface.high set value 320.0f
execute unless predicate math:.common/noise/surface/estimate_nonnegative unless predicate math:.common/noise/surface/density_nonnegative run data modify storage math: internal.noise.surface.low set value -64.0f
function math:.common/noise/surface_iteration
function math:.common/noise/surface_iteration
function math:.common/noise/surface_iteration
function math:.common/noise/surface_iteration
function math:.common/noise/surface_iteration
function math:.common/noise/surface_iteration
function math:.common/noise/surface_iteration
function math:.common/noise/surface_iteration
