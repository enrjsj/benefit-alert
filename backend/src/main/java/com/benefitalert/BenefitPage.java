package com.benefitalert;
import java.util.List;
public record BenefitPage(List<Benefit> items, long total) {}
