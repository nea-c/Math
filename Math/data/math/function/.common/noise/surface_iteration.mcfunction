data modify storage math: internal.noise.surface.mid set compute default float math:.common/noise/surface/mid
data modify storage math: internal.noise.surface.y set from storage math: internal.noise.surface.mid
function math:.common/noise/surface_density_sample
execute if predicate math:.common/noise/surface/density_nonnegative run data modify storage math: internal.noise.surface.low set from storage math: internal.noise.surface.mid
execute unless predicate math:.common/noise/surface/density_nonnegative run data modify storage math: internal.noise.surface.high set from storage math: internal.noise.surface.mid
